from flask import Flask, jsonify, request, render_template
from flask_pymysql import MySQL # Changed from flask_mysqldb
from datetime import datetime

app = Flask(__name__, template_folder='.', static_folder='.')

# --- MySQL Configuration ---
# Now using Flask-PyMySQL which is more compatible for deployment
app.config['MYSQL_HOST'] = 'mysql6013.site4now.net'
app.config['MYSQL_USER'] = 'abc901_elhaqom'
app.config['MYSQL_PASSWORD'] = 'omarreda123' # <-- IMPORTANT: REPLACE WITH YOUR ACTUAL PASSWORD
app.config['MYSQL_DB'] = 'db_abc901_elhaqom'
app.config['MYSQL_CURSORCLASS'] = 'DictCursor'

mysql = MySQL(app)

# --- Routes ---

@app.route('/')
def index():
    """Serves the main HTML page."""
    return render_template('medical_student_dashboard.html')

@app.route('/api/data', methods=['GET'])
def get_all_data():
    """Fetches all initial data needed for the dashboard."""
    cur = mysql.connection.cursor()
    
    # Fetch subjects and related data
    cur.execute("SELECT * FROM subjects")
    subjects = list(cur.fetchall())
    for subject in subjects:
        cur.execute("SELECT * FROM lectures WHERE subject_id = %s", [subject['id']])
        subject['lectures'] = list(cur.fetchall())
        cur.execute("SELECT * FROM videos WHERE subject_id = %s", [subject['id']])
        subject['videos'] = list(cur.fetchall())
        cur.execute("SELECT * FROM flashcards WHERE subject_id = %s", [subject['id']])
        subject['flashcards'] = list(cur.fetchall())

    # Fetch other data
    cur.execute("SELECT * FROM exams")
    exams = list(cur.fetchall())
    
    cur.execute("SELECT * FROM mistakes")
    mistakes = list(cur.fetchall())
    
    # ... Fetch gym, courses, basketball data similarly ...
    
    cur.close()
    
    return jsonify({
        'subjects': subjects,
        'exams': exams,
        'mistakes': mistakes,
        # ... other data categories
    })

@app.route('/api/subjects', methods=['POST'])
def add_subject():
    """Adds a new subject."""
    data = request.get_json()
    name = data.get('name')
    if not name:
        return jsonify({'error': 'Subject name is required'}), 400
        
    cur = mysql.connection.cursor()
    cur.execute("INSERT INTO subjects (name) VALUES (%s)", [name])
    mysql.connection.commit()
    new_id = cur.lastrowid
    cur.close()
    
    return jsonify({'id': new_id, 'name': name, 'lectures': [], 'videos': [], 'flashcards': []}), 201

# --- You would continue to build out API endpoints for every action ---
# Example: Add lecture
@app.route('/api/lectures', methods=['POST'])
def add_lecture():
    data = request.get_json()
    subject_id = data.get('subject_id')
    # ... get other lecture data ...
    
    cur = mysql.connection.cursor()
    cur.execute("INSERT INTO lectures (subject_id, uni_lecs, studied, revised) VALUES (%s, %s, %s, %s)", 
                [subject_id, 1, 0, False])
    mysql.connection.commit()
    new_id = cur.lastrowid
    cur.close()
    
    return jsonify({'id': new_id, 'subject_id': subject_id, 'uni_lecs': 1, 'studied': 0, 'revised': False}), 201

# Example: Update lecture
@app.route('/api/lectures/<int:lecture_id>', methods=['PUT'])
def update_lecture(lecture_id):
    data = request.get_json()
    # ... get fields to update from data ...
    
    # cur = mysql.connection.cursor()
    # cur.execute("UPDATE lectures SET studied = %s, revised = %s WHERE id = %s", 
    #             [data['studied'], data['revised'], lecture_id])
    # mysql.connection.commit()
    # cur.close()
    
    return jsonify({'message': 'Lecture updated successfully'})

# ... Add routes for all other functionalities:
# - Courses (GET, POST, PUT)
# - Gym (GET, POST, PUT)
# - Basketball (GET, POST, PUT)
# - Schedule (GET, POST, PUT, DELETE)
# - Pomodoro logs (POST)
# - Mistakes (POST)
# - Exams (POST)

if __name__ == '__main__':
    app.run(debug=True)
