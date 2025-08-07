# app.py
import os
from flask import Flask, render_template, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.sql import func
from datetime import datetime, date, timedelta
import json

app = Flask(__name__)

# --- Database Configuration ---
USER = 'abc901_elhaqom'
PASSWORD = 'omarreda123'
SERVER = 'mysql6013.site4now.net'
DATABASE = 'db_abc901_elhaqom'

app.config['SQLALCHEMY_DATABASE_URI'] = f'mysql+pymysql://{USER}:{PASSWORD}@{SERVER}/{DATABASE}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ECHO'] = False
app.config['SQLALCHEMY_POOL_RECYCLE'] = 240
app.config['SQLALCHEMY_POOL_TIMEOUT'] = 20
app.config['SQLALCHEMY_POOL_PRE_PING'] = True

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
    total_time = db.Column(db.Integer, default=0)
    pomodoros_done = db.Column(db.Integer, default=0)
    finished_date = db.Column(db.Date, nullable=True)

class Flashcard(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    subject_id = db.Column(db.Integer, db.ForeignKey('subject.id'), nullable=False)
    lecture_id = db.Column(db.Integer, nullable=False)
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
    duration = db.Column(db.Integer, nullable=False)
    subject_id = db.Column(db.Integer, db.ForeignKey('subject.id'), nullable=True)
    lecture_id = db.Column(db.Integer, nullable=True)

class Course(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(150), nullable=False)
    platform = db.Column(db.String(100))
    category = db.Column(db.String(100))
    total_units = db.Column(db.Integer, default=0)
    target_date = db.Column(db.Date, nullable=True)
    sessions_per_week = db.Column(db.Integer, default=1)
    units = db.relationship('CourseUnit', backref='course', lazy=True, cascade="all, delete-orphan")
    
    @property
    def completed_units(self):
        return CourseUnit.query.filter_by(course_id=self.id, is_complete=True).count()

class CourseUnit(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey('course.id'), nullable=False)
    unit_number = db.Column(db.Integer, nullable=False)
    is_complete = db.Column(db.Boolean, default=False)

class Goal(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.String(255), nullable=False)
    is_complete = db.Column(db.Boolean, default=False)

class CustomEvent(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(150), nullable=False)
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    event_date = db.Column(db.Date, default=date.today)
    color = db.Column(db.String(20), default='purple')

class Exercise(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    group = db.Column(db.String(50))
    cues = db.Column(db.String(255))
    tags = db.Column(db.JSON)
    prs = db.relationship('PR', backref='exercise', lazy=True, cascade="all, delete-orphan")
    sessions = db.relationship('GymSessionLog', backref='exercise', lazy=True)

class PR(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    exercise_id = db.Column(db.Integer, db.ForeignKey('exercise.id'), nullable=False)
    weight = db.Column(db.Float, nullable=False)
    reps = db.Column(db.Integer, nullable=False)
    date = db.Column(db.Date, default=date.today)

class GymSessionLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    exercise_id = db.Column(db.Integer, db.ForeignKey('exercise.id'), nullable=False)
    date = db.Column(db.Date, default=date.today)
    sets = db.Column(db.Integer)
    reps = db.Column(db.Integer)
    weight = db.Column(db.Float)

class GymPlanner(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    day_of_week = db.Column(db.String(10), unique=True, nullable=False)
    workout_name = db.Column(db.String(100))
    exercise_ids = db.Column(db.JSON)

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
        if isinstance(value, (datetime, date, db.Time)): value = value.isoformat()
        d[column.name] = value
    return d

def ensure_defaults_exist():
    if not BasketballPlayer.query.first():
        db.session.add(BasketballPlayer(name='Player 1'))
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    for day in days:
        if not GymPlanner.query.filter_by(day_of_week=day).first():
            db.session.add(GymPlanner(day_of_week=day, workout_name="Rest", exercise_ids=[]))
    db.session.commit()

# --- HTML Routes ---
@app.route('/')
def index():
    with app.app_context():
        db.create_all()
        ensure_defaults_exist()
    return render_template('index.html')

# --- API Routes ---
@app.route('/api/dashboard_metrics', methods=['GET'])
def get_dashboard_metrics():
    today = date.today()
    lectures_finished_today = db.session.query(func.count(Lecture.id)).filter(Lecture.finished_date == today).scalar()
    gym_sessions_today = db.session.query(func.count(db.distinct(GymSessionLog.exercise_id))).filter(GymSessionLog.date == today).scalar()
    return jsonify({
        'goals': {
            'lectures': {'current': lectures_finished_today, 'target': 2},
            'gym': {'current': 1 if gym_sessions_today > 0 else 0, 'target': 1},
            'courses': {'current': 0, 'target': 1}
        },
        'pomodoro': {
            'daily': db.session.query(func.sum(PomodoroLog.duration)).filter(func.date(PomodoroLog.date) == today).scalar() or 0,
            'weekly': db.session.query(func.sum(PomodoroLog.duration)).filter(PomodoroLog.date >= (today - timedelta(days=today.weekday()))).scalar() or 0,
            'monthly': db.session.query(func.sum(PomodoroLog.duration)).filter(PomodoroLog.date >= today.replace(day=1)).scalar() or 0
        },
        'exams': [to_dict(e) for e in Exam.query.order_by(Exam.date.asc()).all()],
        'weak_topics': [{'topic': wt[0], 'subject_name': wt[1]} for wt in Mistake.query.join(Subject).with_entities(Mistake.topic, Subject.name).limit(5).all()]
    })

# --- Reset Data Routes ---
@app.route('/api/reset/<section>', methods=['POST'])
def reset_data(section):
    try:
        if section == 'subjects':
            db.session.query(Lecture).delete()
            db.session.query(Subject).delete()
        elif section == 'courses':
            db.session.query(CourseUnit).delete()
            db.session.query(Course).delete()
        elif section == 'gym':
            db.session.query(GymSessionLog).delete()
            db.session.query(PR).delete()
            db.session.query(Exercise).delete()
        elif section == 'basketball':
            db.session.query(Shot).delete()
            db.session.query(VideoTag).delete()
            db.session.query(BasketballPlayer).delete()
            ensure_defaults_exist()
        else:
            return jsonify({'error': 'Invalid section'}), 400
        db.session.commit()
        return jsonify({'message': f'{section} data has been reset.'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# --- Subject/Lecture Routes ---
@app.route('/api/subjects', methods=['GET'])
def get_subjects():
    subjects = Subject.query.options(db.joinedload(Subject.lectures)).order_by(Subject.id).all()
    result = [{'lectures': sorted([to_dict(l) for l in s.lectures], key=lambda x: x['lecture_number']), **to_dict(s)} for s in subjects]
    return jsonify(result)

@app.route('/api/subjects', methods=['POST'])
def add_subject():
    data = request.json
    new_subject = Subject(name=data['name'].strip())
    db.session.add(new_subject)
    db.session.commit()
    return jsonify(to_dict(new_subject)), 201

@app.route('/api/subjects/<int:subject_id>/lectures', methods=['POST'])
def add_lecture(subject_id):
    last_lecture = Lecture.query.filter_by(subject_id=subject_id).order_by(Lecture.lecture_number.desc()).first()
    new_lecture = Lecture(subject_id=subject_id, lecture_number=(last_lecture.lecture_number + 1) if last_lecture else 1)
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
    lecture.finished_date = date.today() if (lecture.uni_lecs > 0 and lecture.studied >= lecture.uni_lecs) else None
    db.session.commit()
    return jsonify(to_dict(lecture))

# --- Course Routes ---
@app.route('/api/courses', methods=['GET'])
def get_courses():
    courses = Course.query.all()
    result = []
    for c in courses:
        course_dict = to_dict(c)
        course_dict['completed_units'] = c.completed_units
        course_dict['units'] = [to_dict(u) for u in c.units]
        result.append(course_dict)
    return jsonify(result)

@app.route('/api/courses', methods=['POST'])
def add_course():
    data = request.json
    new_course = Course(title=data.get('title'), platform=data.get('platform'), category=data.get('category'), total_units=data.get('total_units', 0), target_date=datetime.strptime(data['target_date'], '%Y-%m-%d').date() if data.get('target_date') else None, sessions_per_week=data.get('sessions_per_week'))
    db.session.add(new_course)
    db.session.commit()
    for i in range(1, new_course.total_units + 1):
        db.session.add(CourseUnit(course_id=new_course.id, unit_number=i))
    db.session.commit()
    return jsonify(to_dict(new_course)), 201

@app.route('/api/course_units/<int:unit_id>', methods=['PUT'])
def update_course_unit(unit_id):
    unit = CourseUnit.query.get_or_404(unit_id)
    unit.is_complete = request.json.get('is_complete', unit.is_complete)
    db.session.commit()
    return jsonify(to_dict(unit))

# --- Goal Routes ---
@app.route('/api/goals', methods=['GET'])
def get_goals():
    return jsonify([to_dict(g) for g in Goal.query.all()])

@app.route('/api/goals', methods=['POST'])
def add_goal():
    data = request.json
    new_goal = Goal(text=data['text'])
    db.session.add(new_goal)
    db.session.commit()
    return jsonify(to_dict(new_goal)), 201

@app.route('/api/goals/<int:goal_id>', methods=['PUT'])
def update_goal(goal_id):
    goal = Goal.query.get_or_404(goal_id)
    goal.is_complete = request.json.get('is_complete', goal.is_complete)
    db.session.commit()
    return jsonify(to_dict(goal))

# --- Gym Routes ---
@app.route('/api/gym/planner', methods=['GET'])
def get_gym_planner():
    return jsonify([to_dict(p) for p in GymPlanner.query.order_by(GymPlanner.id).all()])

@app.route('/api/gym/planner', methods=['PUT'])
def update_gym_planner():
    data = request.json
    for day_plan in data:
        plan = GymPlanner.query.filter_by(day_of_week=day_plan['day_of_week']).first()
        if plan:
            plan.workout_name = day_plan['workout_name']
            plan.exercise_ids = day_plan['exercise_ids']
    db.session.commit()
    return jsonify({'message': 'Planner updated successfully'})

@app.route('/api/gym/today', methods=['GET'])
def get_todays_workout():
    today_str = date.today().strftime('%A')
    plan = GymPlanner.query.filter_by(day_of_week=today_str).first()
    if not plan or not plan.exercise_ids:
        return jsonify({'name': 'Rest Day', 'exercises': []})
    
    exercises = Exercise.query.filter(Exercise.id.in_(plan.exercise_ids)).all()
    result_exercises = []
    for ex in exercises:
        last_session = GymSessionLog.query.filter_by(exercise_id=ex.id).order_by(GymSessionLog.date.desc()).first()
        ex_dict = to_dict(ex)
        ex_dict['history'] = to_dict(last_session)
        result_exercises.append(ex_dict)
        
    return jsonify({'name': plan.workout_name, 'exercises': result_exercises})

# --- Other Routes ---
@app.route('/api/pomodoro', methods=['POST'])
def log_pomodoro():
    data = request.json
    log = PomodoroLog(duration=data['duration'], subject_id=data.get('subject_id'), lecture_id=data.get('lecture_id'))
    db.session.add(log)
    lecture = Lecture.query.filter_by(id=data.get('lecture_id')).first()
    if lecture:
        lecture.total_time = (lecture.total_time or 0) + data['duration']
        lecture.pomodoros_done = (lecture.pomodoros_done or 0) + 1
    db.session.commit()
    return jsonify(to_dict(log)), 201

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
        result.append({**to_dict(pr), 'exercise_name': ex_name})
    return jsonify(result)

@app.route('/api/basketball/players', methods=['POST'])
def add_bball_player():
    data = request.json
    name = data['name'].strip()
    new_player = BasketballPlayer(name=name)
    db.session.add(new_player)
    db.session.commit()
    return jsonify(to_dict(new_player)), 201

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
        'tags': [{**to_dict(t), 'player_name': t.player.name if t.player else 'Unknown Player'} for t in tags],
        'shots': [to_dict(s) for s in shots],
        'stats': list(stats.values())
    })

@app.route('/api/basketball/tags', methods=['POST'])
def add_bball_tag():
    data = request.json
    new_tag = VideoTag(time=data['time'], player_id=data['player_id'], category=data['category'], action=data['action'], stat_type=data['stat_type'])
    db.session.add(new_tag)
    db.session.commit()
    return jsonify(to_dict(new_tag)), 201

@app.route('/api/basketball/shots', methods=['POST'])
def add_bball_shot():
    data = request.json
    player_id = data.get('player_id', 1)
    new_shot = Shot(x=data['x'], y=data['y'], made=data['made'], player_id=player_id)
    db.session.add(new_shot)
    db.session.commit()
    return jsonify(to_dict(new_shot)), 201

@app.route('/api/exams', methods=['GET'])
def get_exams():
    return jsonify([to_dict(e) for e in Exam.query.order_by(Exam.date.asc()).all()])

@app.route('/api/flashcards', methods=['POST'])
def add_flashcard():
    data = request.json
    new_flashcard = Flashcard(subject_id=data['subject_id'], lecture_id=data['lecture_id'], front=data['front'], back=data['back'])
    db.session.add(new_flashcard)
    db.session.commit()
    return jsonify(to_dict(new_flashcard)), 201

@app.route('/api/schedule', methods=['GET'])
def get_schedule():
    return jsonify([to_dict(e) for e in CustomEvent.query.filter_by(event_date=date.today()).all()])

if __name__ == '__main__':
    app.run(debug=True)
