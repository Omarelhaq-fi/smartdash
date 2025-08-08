# app.py
import os
from flask import Flask, render_template, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.sql import func
from datetime import datetime, date, timedelta, time

app = Flask(__name__)

# --- Database Configuration ---
# In a real application, use environment variables for credentials
USER = os.environ.get('DB_USER', 'abc901_elhaqom')
PASSWORD = os.environ.get('DB_PASSWORD', 'omarreda123')
SERVER = os.environ.get('DB_SERVER', 'mysql6013.site4now.net')
DATABASE = os.environ.get('DB_DATABASE', 'db_abc901_elhaqom')

app.config['SQLALCHEMY_DATABASE_URI'] = f'mysql+pymysql://{USER}:{PASSWORD}@{SERVER}/{DATABASE}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ECHO'] = False # Set to True for debugging SQL

db = SQLAlchemy(app)

# --- Database Models ---

class Subject(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    lectures = db.relationship('Lecture', backref='subject', lazy=True, cascade="all, delete-orphan")

class Lecture(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    subject_id = db.Column(db.Integer, db.ForeignKey('subject.id'), nullable=False)
    lecture_number = db.Column(db.Integer, nullable=False)
    uni_lecs = db.Column(db.Integer, default=1)
    studied = db.Column(db.Integer, default=0)
    revised = db.Column(db.Boolean, default=False)
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
    subject = db.relationship('Subject', backref='mistakes')


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

# --- Gym Models (Updated) ---
class Exercise(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    group = db.Column(db.String(50))
    cues = db.Column(db.String(255))
    tags = db.Column(db.JSON)

class GymPlan(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False, index=True)
    start_time = db.Column(db.Time, nullable=True)
    end_time = db.Column(db.Time, nullable=True)
    name = db.Column(db.String(100), default="Workout")
    completed = db.Column(db.Boolean, default=False)
    exercises = db.relationship('GymPlanExercise', backref='plan', lazy=True, cascade="all, delete-orphan")

class GymPlanExercise(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    plan_id = db.Column(db.Integer, db.ForeignKey('gym_plan.id'), nullable=False)
    exercise_id = db.Column(db.Integer, db.ForeignKey('exercise.id'), nullable=False)
    sets = db.Column(db.String(50))
    reps = db.Column(db.String(50))
    weight = db.Column(db.String(50), nullable=True)
    exercise = db.relationship('Exercise', lazy='joined') # Eager load exercise details

class PR(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    exercise_id = db.Column(db.Integer, db.ForeignKey('exercise.id'), nullable=False)
    weight = db.Column(db.Float, nullable=False)
    reps = db.Column(db.Integer, nullable=False)
    date = db.Column(db.Date, default=date.today)
    exercise = db.relationship('Exercise')

# --- Basketball Models (Updated) ---
class BasketballPlayer(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)

class VideoTag(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    time = db.Column(db.Float, nullable=False)
    player_id = db.Column(db.Integer, db.ForeignKey('basketball_player.id'), nullable=False)
    category = db.Column(db.String(100))
    action = db.Column(db.String(100))
    # Added more stat types
    stat_type = db.Column(db.String(50)) # e.g., fga_made, fga_missed, ast, reb, stl, blk, tov
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
        if isinstance(value, (datetime, date, time)):
            value = value.isoformat()
        d[column.name] = value
    return d

# --- HTML Routes ---
@app.route('/')
def index():
    # This ensures tables are created on first run
    with app.app_context():
        db.create_all()
    return render_template('index.html')

# --- API Routes ---

# Dashboard (Updated)
@app.route('/api/dashboard_metrics', methods=['GET'])
def get_dashboard_metrics():
    today = date.today()
    start_of_week = today - timedelta(days=today.weekday())
    start_of_month = today.replace(day=1)

    daily_total = db.session.query(func.sum(PomodoroLog.duration)).filter(func.date(PomodoroLog.date) == today).scalar() or 0
    weekly_total = db.session.query(func.sum(PomodoroLog.duration)).filter(PomodoroLog.date >= start_of_week).scalar() or 0
    monthly_total = db.session.query(func.sum(PomodoroLog.duration)).filter(PomodoroLog.date >= start_of_month).scalar() or 0
    
    exams = Exam.query.filter(Exam.date >= today).order_by(Exam.date.asc()).all()
    
    # Using joinedload for efficiency
    weak_topics_query = Mistake.query.options(db.joinedload(Mistake.subject)).order_by(Mistake.id.desc()).limit(5).all()
    weak_topics = [{'topic': m.topic, 'subject_name': m.subject.name} for m in weak_topics_query]

    # New: Check for unfinished gym sessions today
    gym_notification = None
    todays_gym_plan = GymPlan.query.filter_by(date=today, completed=False).first()
    if todays_gym_plan:
        gym_notification = f"You have a '{todays_gym_plan.name}' session planned for today!"

    return jsonify({
        'pomodoro': {'daily': daily_total, 'weekly': weekly_total, 'monthly': monthly_total},
        'exams': [to_dict(e) for e in exams],
        'weak_topics': weak_topics,
        'gym_notification': gym_notification
    })

# Schedule (Updated to include Gym Plans)
@app.route('/api/schedule', methods=['GET'])
def get_schedule():
    today = date.today()
    custom_events = CustomEvent.query.filter_by(event_date=today).all()
    gym_plans = GymPlan.query.filter_by(date=today).all()

    events = []
    for e in custom_events:
        events.append({
            'title': e.title,
            'start_time': e.start_time.strftime('%H:%M'),
            'end_time': e.end_time.strftime('%H:%M'),
            'color': e.color
        })
    
    for gp in gym_plans:
        if gp.start_time and gp.end_time:
            events.append({
                'title': f"Gym: {gp.name}",
                'start_time': gp.start_time.strftime('%H:%M'),
                'end_time': gp.end_time.strftime('%H:%M'),
                'color': 'green' if gp.completed else 'red'
            })

    return jsonify(events)

# Subjects & Lectures (No major changes)
@app.route('/api/subjects', methods=['GET'])
def get_subjects():
    subjects = Subject.query.options(db.joinedload(Subject.lectures)).order_by(Subject.id).all()
    result = []
    for s in subjects:
        subject_dict = to_dict(s)
        subject_dict['lectures'] = sorted([to_dict(l) for l in s.lectures], key=lambda x: x['lecture_number'])
        result.append(subject_dict)
    return jsonify(result)

# ... other unchanged routes (add_subject, add_lecture, etc.)

# --- Gym API Routes (All New or Updated) ---

@app.route('/api/gym/planner', methods=['GET'])
def get_gym_plan():
    start_date_str = request.args.get('start_date')
    start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
    end_date = start_date + timedelta(days=6)
    
    plans = GymPlan.query.filter(GymPlan.date.between(start_date, end_date)).order_by(GymPlan.date, GymPlan.start_time).all()
    
    plans_by_day = { (start_date + timedelta(days=i)).isoformat(): [] for i in range(7) }

    for plan in plans:
        plan_dict = to_dict(plan)
        plan_dict['exercises'] = [
            {**to_dict(pe), 'exercise_name': pe.exercise.name} 
            for pe in plan.exercises
        ]
        plans_by_day[plan.date.isoformat()].append(plan_dict)
        
    return jsonify(plans_by_day)

@app.route('/api/gym/planner', methods=['POST'])
def add_gym_plan():
    data = request.json
    
    new_plan = GymPlan(
        date=datetime.strptime(data['date'], '%Y-%m-%d').date(),
        name=data['name'],
        start_time=datetime.strptime(data['start_time'], '%H:%M').time(),
        end_time=datetime.strptime(data['end_time'], '%H:%M').time()
    )
    db.session.add(new_plan)
    db.session.flush() # To get the new_plan.id

    for ex_data in data['exercises']:
        exercise = GymPlanExercise(
            plan_id=new_plan.id,
            exercise_id=ex_data['exercise_id'],
            sets=ex_data['sets'],
            reps=ex_data['reps'],
            weight=ex_data.get('weight')
        )
        db.session.add(exercise)
    
    db.session.commit()
    return jsonify({'message': 'Plan created'}), 201

@app.route('/api/gym/plan/<int:plan_id>/complete', methods=['PUT'])
def complete_gym_plan(plan_id):
    plan = GymPlan.query.get_or_404(plan_id)
    plan.completed = True
    db.session.commit()
    # Log PRs if applicable
    for exercise_plan in plan.exercises:
        # Simple check: if weight is present, consider it for a PR.
        try:
            weight_val = float(exercise_plan.weight.lower().replace('kg','').strip())
            reps_val = int(exercise_plan.reps.split('-')[-1]) # take upper range for reps
            
            if weight_val > 0 and reps_val > 0:
                existing_pr = PR.query.filter_by(exercise_id=exercise_plan.exercise_id).order_by(PR.weight.desc(), PR.reps.desc()).first()
                # Estimated 1 Rep Max
                e1rm = weight_val * (1 + reps_val / 30)
                existing_e1rm = (existing_pr.weight * (1 + existing_pr.reps / 30)) if existing_pr else 0

                if e1rm > existing_e1rm:
                    new_pr = PR(exercise_id=exercise_plan.exercise_id, weight=weight_val, reps=reps_val, date=plan.date)
                    db.session.add(new_pr)
        except (ValueError, AttributeError):
            continue # Skip if weight/reps are not in a parsable format

    db.session.commit()
    return jsonify({'message': 'Plan marked as complete and PRs updated.'})


@app.route('/api/gym/today', methods=['GET'])
def get_todays_workout():
    today = date.today()
    plan = GymPlan.query.options(
        db.joinedload(GymPlan.exercises).joinedload(GymPlanExercise.exercise)
    ).filter_by(date=today).first()

    if not plan:
        return jsonify(None)

    plan_dict = to_dict(plan)
    plan_dict['exercises'] = [
        {**to_dict(pe), 'exercise_name': pe.exercise.name, 'exercise_group': pe.exercise.group} 
        for pe in plan.exercises
    ]
    return jsonify(plan_dict)

@app.route('/api/gym/exercises', methods=['GET'])
def get_exercises(): 
    return jsonify([to_dict(ex) for ex in Exercise.query.order_by(Exercise.name).all()])

@app.route('/api/gym/exercises', methods=['POST'])
def add_exercise(): 
    data = request.json
    new_ex = Exercise(name=data['name'], group=data['group'], cues=data['cues'], tags=data['tags'])
    db.session.add(new_ex)
    db.session.commit()
    return jsonify(to_dict(new_ex)), 201

@app.route('/api/gym/prs', methods=['GET'])
def get_prs():
    prs = PR.query.options(db.joinedload(PR.exercise)).order_by(PR.date.desc()).all()
    result = [{'exercise_name': pr.exercise.name, **to_dict(pr)} for pr in prs]
    return jsonify(result)


# --- Basketball API Routes (Updated) ---

@app.route('/api/basketball/players', methods=['POST'])
def add_bball_player():
    data = request.json
    name = data['name'].strip()
    if not name: return jsonify({'error': 'Player name cannot be empty'}), 400
    if BasketballPlayer.query.filter_by(name=name).first():
        return jsonify({'error': 'Player with this name already exists'}), 409
    new_player = BasketballPlayer(name=name)
    db.session.add(new_player)
    db.session.commit()
    return jsonify(to_dict(new_player)), 201

@app.route('/api/basketball/data', methods=['GET'])
def get_bball_data():
    players = BasketballPlayer.query.all()
    tags = VideoTag.query.options(db.joinedload(VideoTag.player)).order_by(VideoTag.time).all()
    shots = Shot.query.all()
    
    # Calculate stats on the fly
    stats = {p.id: {'name': p.name, 'PTS': 0, 'FGM': 0, 'FGA': 0, 'AST': 0, 'REB': 0, 'STL': 0, 'BLK': 0, 'TOV': 0} for p in players}
    
    for shot in shots:
        if shot.player_id in stats:
            stats[shot.player_id]['FGA'] += 1
            if shot.made:
                stats[shot.player_id]['FGM'] += 1
                stats[shot.player_id]['PTS'] += 2 # Assuming all shots are 2 pointers for simplicity
    
    for tag in tags:
        if tag.player_id in stats:
            if tag.stat_type == 'ast': stats[tag.player_id]['AST'] += 1
            elif tag.stat_type == 'reb': stats[tag.player_id]['REB'] += 1
            elif tag.stat_type == 'stl': stats[tag.player_id]['STL'] += 1
            elif tag.stat_type == 'blk': stats[tag.player_id]['BLK'] += 1
            elif tag.stat_type == 'tov': stats[tag.player_id]['TOV'] += 1
    
    return jsonify({
        'players': [to_dict(p) for p in players],
        'tags': [{**to_dict(t), 'player_name': t.player.name} for t in tags],
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

# All other non-modified routes are assumed to be here...
# (add_course, get_courses, add_exam, get_exams, etc.)
# For brevity, I am omitting the routes that had no changes.
# You should merge this file with your existing app.py, replacing the modified functions/models.

if __name__ == '__main__':
    # This allows the app to run from the command line
    # In a production environment, you would use a WSGI server like Gunicorn
    app.run(debug=True)
