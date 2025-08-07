# app.py
import os
from flask import Flask, render_template, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.sql import func
from datetime import datetime, date, timedelta

app = Flask(__name__)

# --- Database Configuration ---
USER = 'abc901_elhaqom'
PASSWORD = 'omarreda123'
SERVER = 'mysql6013.site4now.net'
DATABASE = 'db_abc901_elhaqom'

app.config['SQLALCHEMY_DATABASE_URI'] = f'mysql+pymysql://{USER}:{PASSWORD}@{SERVER}/{DATABASE}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ECHO'] = False # Set to True to see generated SQL in your terminal

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

# --- Gym Models ---
class Exercise(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    group = db.Column(db.String(50))
    cues = db.Column(db.String(255))
    tags = db.Column(db.JSON) # Store tags as a JSON array
    prs = db.relationship('PR', backref='exercise', lazy=True, cascade="all, delete-orphan")

class PR(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    exercise_id = db.Column(db.Integer, db.ForeignKey('exercise.id'), nullable=False)
    weight = db.Column(db.Float, nullable=False)
    reps = db.Column(db.Integer, nullable=False)
    date = db.Column(db.Date, default=date.today)

# --- Basketball Models ---
class BasketballPlayer(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)

class VideoTag(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    time = db.Column(db.Float, nullable=False)
    player_id = db.Column(db.Integer, db.ForeignKey('basketball_player.id'), nullable=False)
    category = db.Column(db.String(100))
    action = db.Column(db.String(100))
    stat_type = db.Column(db.String(50))
    player = db.relationship('BasketballPlayer')

class Shot(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    x = db.Column(db.Float, nullable=False)
    y = db.Column(db.Float, nullable=False)
    made = db.Column(db.Boolean, nullable=False)
    player_id = db.Column(db.Integer, db.ForeignKey('basketball_player.id'), nullable=False)
    player = db.relationship('BasketballPlayer')


# --- Helper Functions ---
def to_dict(model_instance):
    if model_instance is None: return None
    d = {}
    for column in model_instance.__table__.columns:
        value = getattr(model_instance, column.name)
        if isinstance(value, (datetime, date, db.Model.metadata.tables['custom_event'].c.start_time.type.python_type)):
            value = value.isoformat()
        d[column.name] = value
    return d

def ensure_default_player_exists():
    """Checks for a default player and creates one if not found. This prevents crashes."""
    player = BasketballPlayer.query.get(1)
    if not player:
        default_player = BasketballPlayer(id=1, name='Player 1')
        db.session.add(default_player)
        db.session.commit()

# --- HTML Routes ---
@app.route('/')
def index():
    with app.app_context():
        db.create_all()
        ensure_default_player_exists() # FIX: Ensure a default player is always available
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
        'pomodoro': {'daily': daily_total, 'weekly': weekly_total, 'monthly': monthly_total},
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
    if not data or 'name' not in data or not data['name'].strip(): return jsonify({'error': 'Subject name is required'}), 400
    if Subject.query.filter_by(name=data['name'].strip()).first(): return jsonify({'error': 'Subject with this name already exists'}), 409
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

# Exams, Mistakes, Pomodoro, Courses, Schedule... (These routes are unchanged)
@app.route('/api/exams', methods=['GET'])
def get_exams():
    return jsonify([to_dict(e) for e in Exam.query.order_by(Exam.date.asc()).all()])

@app.route('/api/exams', methods=['POST'])
def add_exam():
    data = request.json
    exam_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
    new_exam = Exam(name=data['name'], date=exam_date)
    db.session.add(new_exam)
    db.session.commit()
    return jsonify(to_dict(new_exam)), 201

@app.route('/api/mistakes', methods=['POST'])
def add_mistake():
    data = request.json
    new_mistake = Mistake(topic=data['topic'], description=data['description'], subject_id=data['subject_id'])
    db.session.add(new_mistake)
    db.session.commit()
    return jsonify(to_dict(new_mistake)), 201

@app.route('/api/pomodoro', methods=['POST'])
def log_pomodoro():
    data = request.json
    log = PomodoroLog(duration=data['duration'], subject_id=data.get('subject_id'), lecture_id=data.get('lecture_id'))
    db.session.add(log)
    if data.get('subject_id') and data.get('lecture_id'):
        lecture = Lecture.query.filter_by(subject_id=data['subject_id'], lecture_number=data['lecture_id']).first()
        if lecture: lecture.total_time += data['duration']
    db.session.commit()
    return jsonify(to_dict(log)), 201

@app.route('/api/courses', methods=['GET'])
def get_courses():
    return jsonify([to_dict(c) for c in Course.query.all()])

@app.route('/api/courses', methods=['POST'])
def add_course():
    data = request.json
    new_course = Course(title=data.get('title'), platform=data.get('platform'), category=data.get('category'), total_units=data.get('total_units'), completed_units=data.get('completed_units'), target_date=datetime.strptime(data['target_date'], '%Y-%m-%d').date() if data.get('target_date') else None, sessions_per_week=data.get('sessions_per_week'))
    db.session.add(new_course)
    db.session.commit()
    return jsonify(to_dict(new_course)), 201

@app.route('/api/schedule', methods=['GET'])
def get_schedule():
    return jsonify([to_dict(e) for e in CustomEvent.query.filter_by(event_date=date.today()).all()])

@app.route('/api/schedule', methods=['POST'])
def add_custom_event():
    data = request.json
    start_time = datetime.strptime(data['start_time'], '%H:%M').time()
    end_time = datetime.strptime(data['end_time'], '%H:%M').time()
    new_event = CustomEvent(title=data.get('title'), start_time=start_time, end_time=end_time, color=data.get('color', 'purple'))
    db.session.add(new_event)
    db.session.commit()
    return jsonify(to_dict(new_event)), 201

@app.route('/api/subjects/<int:subject_id>/lectures/<int:lecture_id>/flashcards', methods=['GET'])
def get_flashcards(subject_id, lecture_id):
    return jsonify([to_dict(f) for f in Flashcard.query.filter_by(subject_id=subject_id, lecture_id=lecture_id).all()])

@app.route('/api/flashcards', methods=['POST'])
def add_flashcard():
    data = request.json
    new_flashcard = Flashcard(subject_id=data['subject_id'], lecture_id=data['lecture_id'], front=data['front'], back=data['back'])
    db.session.add(new_flashcard)
    db.session.commit()
    return jsonify(to_dict(new_flashcard)), 201

# --- Gym API Routes ---
@app.route('/api/gym/exercises', methods=['GET'])
def get_exercises():
    return jsonify([to_dict(ex) for ex in Exercise.query.all()])

@app.route('/api/gym/exercises', methods=['POST'])
def add_exercise():
    data = request.json
    new_ex = Exercise(name=data['name'], group=data['group'], cues=data['cues'], tags=data['tags'])
    db.session.add(new_ex)
    db.session.commit()
    return jsonify(to_dict(new_ex)), 201

@app.route('/api/gym/prs', methods=['GET'])
def get_prs():
    prs = PR.query.join(Exercise).with_entities(PR, Exercise.name).order_by(PR.date.desc()).all()
    result = []
    for pr, ex_name in prs:
        pr_dict = to_dict(pr)
        pr_dict['exercise_name'] = ex_name
        result.append(pr_dict)
    return jsonify(result)

# --- Basketball API Routes ---
@app.route('/api/basketball/data', methods=['GET'])
def get_bball_data():
    players = BasketballPlayer.query.all()
    tags = VideoTag.query.options(db.joinedload(VideoTag.player)).order_by(VideoTag.time).all()
    shots = Shot.query.options(db.joinedload(Shot.player)).all()
    
    stats = {p.id: {'name': p.name, 'FGM': 0, 'FGA': 0, 'AST': 0, 'PTS': 0} for p in players}
    for tag in tags:
        if tag.player_id not in stats: continue
        if tag.stat_type == 'fga_made':
            stats[tag.player_id]['FGM'] += 1
            stats[tag.player_id]['FGA'] += 1
        elif tag.stat_type == 'fga_missed':
            stats[tag.player_id]['FGA'] += 1
        elif tag.stat_type == 'ast':
            stats[tag.player_id]['AST'] += 1
    for p_id in stats:
        stats[p_id]['PTS'] = stats[p_id]['FGM'] * 2
    
    return jsonify({
        'players': [to_dict(p) for p in players],
        'tags': [{**to_dict(t), 'player_name': t.player.name} for t in tags],
        'shots': [to_dict(s) for s in shots],
        'stats': list(stats.values())
    })

@app.route('/api/basketball/tags', methods=['POST'])
def add_bball_tag():
    data = request.json
    player = BasketballPlayer.query.get(data['player_id'])
    if not player: return jsonify({'error': 'Player not found'}), 404
    
    new_tag = VideoTag(time=data['time'], player_id=data['player_id'], category=data['category'], action=data['action'], stat_type=data['stat_type'])
    db.session.add(new_tag)
    db.session.commit()
    return jsonify(to_dict(new_tag)), 201

@app.route('/api/basketball/shots', methods=['POST'])
def add_bball_shot():
    data = request.json
    player_id = data.get('player_id', 1) # Defaulting to 1 is now safe.
    
    if not BasketballPlayer.query.get(player_id):
        return jsonify({'error': f'Player with ID {player_id} not found, but default player should exist.'}), 404

    new_shot = Shot(x=data['x'], y=data['y'], made=data['made'], player_id=player_id)
    db.session.add(new_shot)
    db.session.commit()
    return jsonify(to_dict(new_shot)), 201

if __name__ == '__main__':
    app.run(debug=True)
