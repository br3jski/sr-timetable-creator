import re


def process_line(line):
    parts = line.split('\t')
    if len(parts) >= 3:
        line_id = parts[0].strip()
        full_name = parts[1].strip()

        # Wyodrębnij nazwę linii, usuwając "Zachodnia" i zmieniając myślnik
        name_parts = full_name.split('–')
        if len(name_parts) >= 2:
            start = name_parts[0].replace('Zachodnia', '').strip()
            end = name_parts[-1].strip()
            line_name = f"{start} – {end}"
        else:
            line_name = full_name

        return f"({line_id}, '{line_name}')"
    return None


output = ["INSERT INTO RailwayLines (LineId, LineName) VALUES"]
values = []

with open('lines.txt', 'r', encoding='utf-8') as file:
    for line in file:
        result = process_line(line)
        if result:
            values.append(result)

output.append(',\n'.join(values))
output.append(';')

with open('insert_railway_lines.sql', 'w', encoding='utf-8') as outfile:
    outfile.write('\n'.join(output))

print("Plik SQL został wygenerowany.")