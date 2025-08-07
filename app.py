# app.py
import os
from flask import Flask, render_template, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.sql import func
from datetime import datetime, date, timedelta

app = Flask(__name__)

# --- Database Configuration ---
# Using environment variables for security is a best practice,
# but for this example, we'll use the direct credentials as requested.
# For a real application, consider using os.environ.get('DB_USERNAME') etc.
USER = 'abc901_elhaqom'
PASSWORD = 'omarreda123'
SERVER = 'mysql6013.site4now.net'
DATABASE = 'db_abc901_elhaqom'

app.config['SQLALCHEMY_DATABASE_URI'] = f'mysql+pymysql://{USER}:{PASSWORD}@{SERVER}/{DATABASE}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# --- Database Models ---

class Subject(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    lectures = db.relationship('Lecture', backref='subject', lazy=True, cascade="all, delete-orphan")
    flashcards = db.relationship('Flashcard', backref='subject', lazy=True, cascade="all, delete-orphan")
    mistakes = db.relationship('Mistake', backref='subject', lazy=True, cascade="all, delete-orphan")

class Lecture(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    subject_id = db.Column(db.Integer, db.ForeignKey('subject.id'), nullable=False)
    lecture_number = db.Column(db.Integer, nullable=False)
    uni_lecs = db.Column(db.Integer, default=1)
    studied = db.Column(db.Integer, default=0)
    revised = db.Column(db.Boolean, default=False)
    total_time = db.Column(db.Integer, default=0) # in seconds

class Flashcard(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    subject_id = db.Column(db.Integer, db.ForeignKey('subject.id'), nullable=False)
    lecture_id = db.Column(db.Integer, nullable=False) # Maps to lecture_number
    front = db.Column(db.Text, nullable=False)
    back = db.Column(db.Text, nullable=False)

class Exam(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    date = db.Column(db.Date, nullable=False)

class Mistake(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    topic = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    subject_id = db.Column(db.Integer, db.ForeignKey('subject.id'), nullable=False)

class PomodoroLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.DateTime, default=datetime.utcnow)
    duration = db.Column(db.Integer, nullable=False) # in seconds
    subject_id = db.Column(db.Integer, db.ForeignKey('subject.id'), nullable=True)
    lecture_id = db.Column(db.Integer, nullable=True) # Maps to lecture_number

class Course(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(150), nullable=False)
    platform = db.Column(db.String(100))
    category = db.Column(db.String(100))
    total_units = db.Column(db.Integer, default=0)
    completed_units = db.Column(db.Integer, default=0)
    target_date = db.Column(db.Date, nullable=True)
    sessions_per_week = db.Column(db.Integer, default=1)

class CustomEvent(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(150), nullable=False)
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    event_date = db.Column(db.Date, default=date.today)
    color = db.Column(db.String(20), default='purple')

# --- Helper Functions ---
def to_dict(model_instance):
    """Converts a SQLAlchemy model instance to a dictionary."""
    if model_instance is None:
        return None
    d = {}
    for column in model_instance.__table__.columns:
        d[column.name] = getattr(model_instance, column.name)
        if isinstance(d[column.name], (datetime, date)):
            d[column.name] = d[column.name].isoformat()
    return d

# --- HTML Routes ---
@app.route('/')
def index():
    # This will create all tables if they don't exist
    db.create_all()
    return render_template('index.html')

# --- API Routes ---

# Dashboard
@app.route('/api/dashboard_metrics', methods=['GET'])
def get_dashboard_metrics():
    today = date.today()
    start_of_week = today - timedelta(days=today.weekday())
    start_of_month = today.replace(day=1)

    daily_total = db.session.query(func.sum(PomodoroLog.duration)).filter(func.date(PomodoroLog.date) == today).scalar() or 0
    weekly_total = db.session.query(func.sum(PomodoroLog.duration)).filter(PomodoroLog.date >= start_of_week).scalar() or 0
    monthly_total = db.session.query(func.sum(PomodoroLog.duration)).filter(PomodoroLog.date >= start_of_month).scalar() or 0

    exams = Exam.query.order_by(Exam.date.asc()).all()
    
    weak_topics = Mistake.query.join(Subject).with_entities(Mistake.topic, Subject.name).limit(5).all()

    return jsonify({
        'pomodoro': {
            'daily': daily_total,
            'weekly': weekly_total,
            'monthly': monthly_total
        },
        'exams': [to_dict(e) for e in exams],
        'weak_topics': [{'topic': wt[0], 'subject_name': wt[1]} for wt in weak_topics]
    })

# Subjects & Lectures
@app.route('/api/subjects', methods=['GET'])
def get_subjects():
    subjects = Subject.query.options(db.joinedload(Subject.lectures)).order_by(Subject.id).all()
    result = []
    for s in subjects:
        subject_dict = to_dict(s)
        subject_dict['lectures'] = sorted([to_dict(l) for l in s.lectures], key=lambda x: x['lecture_number'])
        result.append(subject_dict)
    return jsonify(result)

@app.route('/api/subjects', methods=['POST'])
def add_subject():
    data = request.json
    if not data or 'name' not in data or not data['name'].strip():
        return jsonify({'error': 'Subject name is required'}), 400
    
    if Subject.query.filter_by(name=data['name'].strip()).first():
        return jsonify({'error': 'Subject with this name already exists'}), 409

    new_subject = Subject(name=data['name'].strip())
    db.session.add(new_subject)
    db.session.commit()
    return jsonify(to_dict(new_subject)), 201

@app.route('/api/subjects/<int:subject_id>/lectures', methods=['POST'])
def add_lecture(subject_id):
    subject = Subject.query.get_or_404(subject_id)
    last_lecture = Lecture.query.filter_by(subject_id=subject_id).order_by(Lecture.lecture_number.desc()).first()
    new_lecture_number = (last_lecture.lecture_number + 1) if last_lecture else 1
    
    new_lecture = Lecture(subject_id=subject.id, lecture_number=new_lecture_number)
    db.session.add(new_lecture)
    db.session.commit()
    return jsonify(to_dict(new_lecture)), 201

@app.route('/api/lectures/<int:lecture_id>', methods=['PUT'])
def update_lecture(lecture_id):
    data = request.json
    lecture = Lecture.query.get_or_404(lecture_id)
    
    lecture.uni_lecs = data.get('uni_lecs', lecture.uni_lecs)
    lecture.studied = data.get('studied', lecture.studied)
    lecture.revised = data.get('revised', lecture.revised)

    db.session.commit()
    return jsonify(to_dict(lecture))

# Exams
@app.route('/api/exams', methods=['GET'])
def get_exams():
    exams = Exam.query.order_by(Exam.date.asc()).all()
    return jsonify([to_dict(e) for e in exams])

@app.route('/api/exams', methods=['POST'])
def add_exam():
    data = request.json
    if not data or 'name' not in data or 'date' not in data:
        return jsonify({'error': 'Missing data'}), 400
    
    exam_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
    new_exam = Exam(name=data['name'], date=exam_date)
    db.session.add(new_exam)
    db.session.commit()
    return jsonify(to_dict(new_exam)), 201

# Mistakes
@app.route('/api/mistakes', methods=['POST'])
def add_mistake():
    data = request.json
    if not data or not all(k in data for k in ['topic', 'description', 'subject_id']):
        return jsonify({'error': 'Missing data'}), 400
        
    new_mistake = Mistake(
        topic=data['topic'],
        description=data['description'],
        subject_id=data['subject_id']
    )
    db.session.add(new_mistake)
    db.session.commit()
    return jsonify(to_dict(new_mistake)), 201

# Pomodoro
@app.route('/api/pomodoro', methods=['POST'])
def log_pomodoro():
    data = request.json
    if not data or 'duration' not in data:
        return jsonify({'error': 'Duration is required'}), 400
    
    log = PomodoroLog(
        duration=data['duration'],
        subject_id=data.get('subject_id'),
        lecture_id=data.get('lecture_id')
    )
    db.session.add(log)
    
    # Also update lecture time
    if data.get('subject_id') and data.get('lecture_id'):
        lecture = Lecture.query.filter_by(subject_id=data['subject_id'], lecture_number=data['lecture_id']).first()
        if lecture:
            lecture.total_time += data['duration']

    db.session.commit()
    return jsonify(to_dict(log)), 201
    
# Courses
@app.route('/api/courses', methods=['GET'])
def get_courses():
    courses = Course.query.all()
    return jsonify([to_dict(c) for c in courses])

@app.route('/api/courses', methods=['POST'])
def add_course():
    data = request.json
    new_course = Course(
        title=data.get('title'),
        platform=data.get('platform'),
        category=data.get('category'),
        total_units=data.get('total_units'),
        completed_units=data.get('completed_units'),
        target_date=datetime.strptime(data['target_date'], '%Y-%m-%d').date() if data.get('target_date') else None,
        sessions_per_week=data.get('sessions_per_week')
    )
    db.session.add(new_course)
    db.session.commit()
    return jsonify(to_dict(new_course)), 201

# Schedule / Custom Events
@app.route('/api/schedule', methods=['GET'])
def get_schedule():
    events = CustomEvent.query.filter_by(event_date=date.today()).all()
    return jsonify([to_dict(e) for e in events])

@app.route('/api/schedule', methods=['POST'])
def add_custom_event():
    data = request.json
    start_time = datetime.strptime(data['start_time'], '%H:%M').time()
    end_time = datetime.strptime(data['end_time'], '%H:%M').time()
    
    new_event = CustomEvent(
        title=data.get('title'),
        start_time=start_time,
        end_time=end_time,
        color=data.get('color', 'purple')
    )
    db.session.add(new_event)
    db.session.commit()
    return jsonify(to_dict(new_event)), 201

# Flashcards
@app.route('/api/subjects/<int:subject_id>/lectures/<int:lecture_id>/flashcards', methods=['GET'])
def get_flashcards(subject_id, lecture_id):
    flashcards = Flashcard.query.filter_by(subject_id=subject_id, lecture_id=lecture_id).all()
    return jsonify([to_dict(f) for f in flashcards])

@app.route('/api/flashcards', methods=['POST'])
def add_flashcard():
    data = request.json
    new_flashcard = Flashcard(
        subject_id=data['subject_id'],
        lecture_id=data['lecture_id'],
        front=data['front'],
        back=data['back']
    )
    db.session.add(new_flashcard)
    db.session.commit()
    return jsonify(to_dict(new_flashcard)), 201


if __name__ == '__main__':
    # The 'db.create_all()' call should ideally be handled by a migration tool
    # like Flask-Migrate in a production environment. For this example,
    # we'll call it on the first request to the root URL.
    app.run(debug=True)
