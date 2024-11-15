import pyodbc
from flask import Flask, render_template, request, jsonify
from conn import get_db_connection
from datetime import datetime, timedelta
from itertools import groupby, combinations
import re

app = Flask(__name__)

TRAIN_CATEGORIES = [
    "EIJ", "EIE", "ECE", "MME", "MPE", "RPE", "ROJ", "ROE", "RAJ",
    "TAE", "TBE", "TDE", "TNE", "TME", "TKE", "TSE", "LPE", "LTE",
    "ZXE", "ZUE", "PWJ"
]


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/train_categories', methods=['GET'])
def get_train_categories():
    return jsonify(TRAIN_CATEGORIES)


@app.route('/api/schedules', methods=['GET'])
def get_schedules():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT t.TrainNumber, t.TrainCategory, s.StationName, sc.ArrivalTime, sc.DepartureTime, sc.StopType, sc.SequenceNumber
        FROM Schedules sc
        JOIN Trains t ON sc.TrainId = t.TrainId
        JOIN Stations s ON sc.StationId = s.StationId
        ORDER BY t.TrainNumber, sc.SequenceNumber
    """)
    schedules = {}
    for row in cursor.fetchall():
        train_key = f"{row.TrainCategory} {row.TrainNumber}"
        if train_key not in schedules:
            schedules[train_key] = {"category": row.TrainCategory, "id": row.TrainNumber, "stops": []}
        schedules[train_key]["stops"].append({
            "station": row.StationName,
            "arrival": row.ArrivalTime.strftime('%H:%M') if row.ArrivalTime else None,
            "departure": row.DepartureTime.strftime('%H:%M') if row.DepartureTime else None,
            "stopType": row.StopType
        })
    conn.close()
    return jsonify({"schedules": list(schedules.values())})


@app.route('/api/schedules/<string:train_id>', methods=['DELETE'])
def delete_schedule(train_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM Schedules WHERE TrainId IN (SELECT TrainId FROM Trains WHERE TrainNumber = ?)",
                   (train_id,))
    cursor.execute("DELETE FROM Trains WHERE TrainNumber = ?", (train_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": f"Schedule for train {train_id} deleted successfully"}), 200


@app.route('/api/schedules', methods=['POST'])
def add_schedule():
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("INSERT INTO Trains (TrainNumber, TrainCategory) OUTPUT INSERTED.TrainId VALUES (?, ?)",
                   (data['id'], data['category']))
    train_id = cursor.fetchone().TrainId

    for i, stop in enumerate(data['stops']):
        cursor.execute("SELECT StationId FROM Stations WHERE StationName = ?", (stop['station'],))
        station_id = cursor.fetchone().StationId
        cursor.execute("""
            INSERT INTO Schedules (TrainId, StationId, ArrivalTime, DepartureTime, StopType, SequenceNumber) 
            VALUES (?, ?, ?, ?, ?, ?)
        """, (train_id, station_id, stop['arrival'], stop['departure'], stop['stopType'], i))

    conn.commit()
    conn.close()
    return jsonify({"message": "Schedule added successfully"}), 201


@app.route('/api/schedules/replicate', methods=['POST'])
def replicate_schedule():
    source_id = request.json['sourceId']
    new_id = request.json['newId']
    time_shift = request.json.get('timeShift', 0)  # w minutach

    conn = get_db_connection()
    cursor = conn.cursor()

    # Get source schedule
    cursor.execute("""
        SELECT t.TrainCategory, s.StationName, sc.ArrivalTime, sc.DepartureTime, sc.StopType, sc.SequenceNumber
        FROM Schedules sc
        JOIN Trains t ON sc.TrainId = t.TrainId
        JOIN Stations s ON sc.StationId = s.StationId
        WHERE t.TrainNumber = ?
        ORDER BY sc.SequenceNumber
    """, (source_id,))
    source_schedule = cursor.fetchall()

    if source_schedule:
        # Insert new train
        cursor.execute("INSERT INTO Trains (TrainNumber, TrainCategory) OUTPUT INSERTED.TrainId VALUES (?, ?)",
                       (new_id, source_schedule[0].TrainCategory))
        new_train_id = cursor.fetchone().TrainId

        # Replicate stops with time shift
        for stop in source_schedule:
            station_name = stop.StationName
            arrival_time = shift_time(stop.ArrivalTime, time_shift) if stop.ArrivalTime else None
            departure_time = shift_time(stop.DepartureTime, time_shift) if stop.DepartureTime else None

            cursor.execute("SELECT StationId FROM Stations WHERE StationName = ?", (station_name,))
            station_id = cursor.fetchone().StationId

            cursor.execute("""
                INSERT INTO Schedules (TrainId, StationId, ArrivalTime, DepartureTime, StopType, SequenceNumber) 
                VALUES (?, ?, ?, ?, ?, ?)
            """, (new_train_id, station_id, arrival_time, departure_time, stop.StopType, stop.SequenceNumber))

        conn.commit()
        conn.close()
        return jsonify({"message": "Schedule replicated successfully"}), 201
    else:
        conn.close()
        return jsonify({"error": "Source schedule not found"}), 404


def shift_time(time, minutes):
    if time:
        return (datetime.combine(datetime.today(), time) + timedelta(minutes=minutes)).time()
    return None


@app.route('/api/stations', methods=['POST'])
def add_station():
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Sprawdź, czy stacja już istnieje
        cursor.execute("SELECT StationId FROM Stations WHERE StationName = ?", (data['name'],))
        existing_station = cursor.fetchone()

        if existing_station:
            station_id = existing_station.StationId
        else:
            cursor.execute("INSERT INTO Stations (StationName) OUTPUT INSERTED.StationId VALUES (?)",
                           (data['name'],))
            station_id = cursor.fetchone().StationId

        # Dodaj lub zaktualizuj linię dla stacji
        for line in data['lines']:
            cursor.execute("""
                MERGE StationLines AS target
                USING (VALUES (?, ?, ?)) AS source (StationId, LineId, KilometerPosition)
                ON target.StationId = source.StationId AND target.LineId = source.LineId
                WHEN MATCHED THEN
                    UPDATE SET KilometerPosition = source.KilometerPosition
                WHEN NOT MATCHED THEN
                    INSERT (StationId, LineId, KilometerPosition)
                    VALUES (source.StationId, source.LineId, source.KilometerPosition);
            """, (station_id, line['id'], line['kilometer']))

        conn.commit()
        return jsonify({"message": "Station added or updated successfully", "stationId": station_id}), 201

    except pyodbc.IntegrityError as e:
        conn.rollback()
        return jsonify({"error": "Station already exists on this line"}), 400
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@app.route('/api/stations', methods=['GET'])
def get_stations():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT s.StationId, s.StationName, 
               STRING_AGG(CONCAT(sl.LineId, ':', rl.LineName, ':', sl.KilometerPosition), ';') AS LinesInfo
        FROM Stations s
        JOIN StationLines sl ON s.StationId = sl.StationId
        JOIN RailwayLines rl ON sl.LineId = rl.LineId
        GROUP BY s.StationId, s.StationName
        ORDER BY s.StationName
    """)
    stations = cursor.fetchall()
    conn.close()

    result = []
    for station in stations:
        lines = [line.split(':') for line in station.LinesInfo.split(';')]
        result.append({
            "id": station.StationId,
            "name": station.StationName,
            "lines": [{"id": line[0], "name": line[1], "kilometer": line[2]} for line in lines]
        })

    return jsonify(result)


@app.route('/api/station_schedule/<station>')
def get_station_schedule(station):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT t.TrainNumber, t.TrainCategory, sc.ArrivalTime, sc.DepartureTime, sc.StopType,
               first_station.StationName as FirstStation, last_station.StationName as LastStation
        FROM Schedules sc
        JOIN Trains t ON sc.TrainId = t.TrainId
        JOIN Stations s ON sc.StationId = s.StationId
        CROSS APPLY (
            SELECT TOP 1 s2.StationName
            FROM Schedules sc2
            JOIN Stations s2 ON sc2.StationId = s2.StationId
            WHERE sc2.TrainId = sc.TrainId
            ORDER BY sc2.SequenceNumber
        ) first_station
        CROSS APPLY (
            SELECT TOP 1 s3.StationName
            FROM Schedules sc3
            JOIN Stations s3 ON sc3.StationId = s3.StationId
            WHERE sc3.TrainId = sc.TrainId
            ORDER BY sc3.SequenceNumber DESC
        ) last_station
        WHERE s.StationName = ?
        ORDER BY sc.ArrivalTime
    """, (station,))

    station_schedule = []
    for row in cursor.fetchall():
        station_schedule.append({
            'category': row.TrainCategory,
            'id': row.TrainNumber,
            'arrival': row.ArrivalTime.strftime('%H:%M') if row.ArrivalTime else None,
            'departure': row.DepartureTime.strftime('%H:%M') if row.DepartureTime else None,
            'stopType': row.StopType,
            'route': f"{row.FirstStation}-{row.LastStation}"
        })

    # Wykrywanie konfliktów
    conflicts = set()
    for key, group in groupby(station_schedule, key=lambda x: (x['arrival'], x['departure'])):
        group_list = list(group)
        if len(group_list) > 1:
            conflicts.update(train['id'] for train in group_list)

    # Oznaczanie konfliktów
    for train in station_schedule:
        train['conflict'] = train['id'] in conflicts

    conn.close()
    return jsonify({'schedule': station_schedule})


@app.route('/api/schedules/<schedule_id>', methods=['GET'])
def get_schedule(schedule_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT t.TrainNumber, t.TrainCategory, s.StationName, sc.ArrivalTime, sc.DepartureTime, sc.StopType, sc.SequenceNumber
        FROM Schedules sc
        JOIN Trains t ON sc.TrainId = t.TrainId
        JOIN Stations s ON sc.StationId = s.StationId
        WHERE t.TrainNumber = ?
        ORDER BY sc.SequenceNumber
    """, (schedule_id,))

    schedule = None
    stops = []
    for row in cursor.fetchall():
        if not schedule:
            schedule = {"category": row.TrainCategory, "id": row.TrainNumber, "stops": stops}
        stops.append({
            "station": row.StationName,
            "arrival": row.ArrivalTime.strftime('%H:%M') if row.ArrivalTime else None,
            "departure": row.DepartureTime.strftime('%H:%M') if row.DepartureTime else None,
            "stopType": row.StopType
        })

    conn.close()
    if schedule:
        return jsonify(schedule)
    else:
        return jsonify({"error": "Schedule not found"}), 404


@app.route('/api/schedules/<schedule_id>', methods=['PUT'])
def update_schedule(schedule_id):
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()

    # Update train details
    cursor.execute("UPDATE Trains SET TrainCategory = ? WHERE TrainNumber = ?", (data['category'], schedule_id))

    # Delete existing stops
    cursor.execute("DELETE FROM Schedules WHERE TrainId IN (SELECT TrainId FROM Trains WHERE TrainNumber = ?)",
                   (schedule_id,))

    # Insert new stops
    cursor.execute("SELECT TrainId FROM Trains WHERE TrainNumber = ?", (schedule_id,))
    train_id = cursor.fetchone().TrainId

    for i, stop in enumerate(data['stops']):
        cursor.execute("SELECT StationId FROM Stations WHERE StationName = ?", (stop['station'],))
        station_id = cursor.fetchone().StationId
        cursor.execute("""
            INSERT INTO Schedules (TrainId, StationId, ArrivalTime, DepartureTime, StopType, SequenceNumber) 
            VALUES (?, ?, ?, ?, ?, ?)
        """, (train_id, station_id, stop['arrival'], stop['departure'], stop['stopType'], i))

    conn.commit()
    conn.close()
    return jsonify({"message": "Schedule updated successfully"}), 200


@app.route('/api/analyze_conflicts', methods=['GET'])
def analyze_conflicts():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT t1.TrainCategory as Train1Category, t1.TrainNumber as Train1Number,
               t2.TrainCategory as Train2Category, t2.TrainNumber as Train2Number,
               s1.StationName as FromStation, s2.StationName as ToStation,
               sc1.DepartureTime as Train1Departure, sc2.ArrivalTime as Train1Arrival,
               sc2.DepartureTime as Train2Departure, sc2.ArrivalTime as Train2Arrival
        FROM Schedules sc1
        JOIN Schedules sc2 ON sc1.TrainId < sc2.TrainId
        JOIN Trains t1 ON sc1.TrainId = t1.TrainId
        JOIN Trains t2 ON sc2.TrainId = t2.TrainId
        JOIN Stations s1 ON sc1.StationId = s1.StationId
        JOIN Stations s2 ON sc2.StationId = s2.StationId
        WHERE sc1.SequenceNumber = sc2.SequenceNumber - 1
          AND s1.StationName = s2.StationName
          AND sc1.DepartureTime <= sc2.ArrivalTime 
          AND sc1.ArrivalTime >= sc2.DepartureTime
    """)

    conflicts = []
    for row in cursor.fetchall():
        conflicts.append(check_conflict(row))

    conn.close()
    return jsonify({'conflicts': [c for c in conflicts if c is not None]})


def check_conflict(row):
    SAFETY_MARGIN = 2  # 2 minuty marginesu bezpieczeństwa

    train1_departure = row.Train1Departure
    train1_arrival = row.Train1Arrival
    train2_departure = row.Train2Departure
    train2_arrival = row.Train2Arrival

    if (train1_departure <= train2_arrival and train1_arrival >= train2_departure):
        conflict_type = "Critical Conflict"
    elif abs((train1_departure - train2_departure).total_seconds()) <= SAFETY_MARGIN * 60 or \
            abs((train1_arrival - train2_arrival).total_seconds()) <= SAFETY_MARGIN * 60:
        conflict_type = "Potential Conflict"
    elif abs((train1_departure - train2_departure).total_seconds()) <= SAFETY_MARGIN * 120 or \
            abs((train1_arrival - train2_arrival).total_seconds()) <= SAFETY_MARGIN * 120:
        conflict_type = "Close Encounter"
    else:
        return None

    return {
        'train1': f"{row.Train1Category} {row.Train1Number}",
        'train2': f"{row.Train2Category} {row.Train2Number}",
        'section': f"{row.FromStation} - {row.ToStation}",
        'train1_time': f"{train1_departure.strftime('%H:%M')} - {train1_arrival.strftime('%H:%M')}",
        'train2_time': f"{train2_departure.strftime('%H:%M')} - {train2_arrival.strftime('%H:%M')}",
        'conflict_type': conflict_type
    }


@app.route('/conflict_analysis')
def conflict_analysis_page():
    return render_template('conflict_analysis.html')


@app.route('/api/railway_lines', methods=['GET'])
def get_railway_lines():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT LineId, LineName FROM RailwayLines ORDER BY LineId")
    lines = cursor.fetchall()
    conn.close()

    result = [{"id": line.LineId, "name": line.LineName} for line in lines]
    return jsonify(result)


@app.route('/api/station_lines/<int:station_id>', methods=['GET'])
def get_station_lines(station_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT rl.LineId, rl.LineName, sl.KilometerPosition
        FROM StationLines sl
        JOIN RailwayLines rl ON sl.LineId = rl.LineId
        WHERE sl.StationId = ?
    """, (station_id,))
    lines = [{"id": row.LineId, "name": row.LineName, "kilometer": row.KilometerPosition} for row in cursor.fetchall()]
    conn.close()
    return jsonify(lines)

if __name__ == '__main__':
    app.run(debug=True)