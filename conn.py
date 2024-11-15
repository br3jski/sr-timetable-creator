import pyodbc

def get_db_connection():
    server = '10.110.0.1'
    database = 'sr_schedules'
    username = 'scheduler'
    password = 'RawAirPWD2020!'  # Replace with your actual password
    connection_string = (
        'DRIVER={ODBC Driver 17 for SQL Server};'
        f'SERVER={server};DATABASE={database};'
        f'UID={username};PWD={password}'
    )
    return pyodbc.connect(connection_string)
