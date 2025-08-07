document.addEventListener('DOMContentLoaded', function() {
    // --- STATE & UI SELECTORS ---
    let weeklyChart;
    let currentFlashcardState = {};
    const pages = document.querySelectorAll('.page');
    const navLinks = document.querySelectorAll('.sidebar-icon');
    const darkModeToggle = document.getElementById('darkModeToggle');

    // --- API HELPER ---
    async function apiRequest(url, method = 'GET', body = null) {
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (body) {
            options.body = JSON.stringify(body);
        }
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            return response.json();
        } catch (error) {
            console.error(`API request failed: ${method} ${url}`, error);
            alert(`Error: ${error.message}`);
            throw error;
        }
    }

    // --- CORE APP LOGIC ---
    function setupNavigation() {
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.dataset.target;
                pages.forEach(page => page.classList.add('hidden'));
                document.getElementById(targetId).classList.remove('hidden');
                navLinks.forEach(nav => nav.classList.remove('active'));
                link.classList.add('active');
                // Load data for the activated page
                loadPageData(targetId);
            });
        });
    }
    
    function loadPageData(pageId) {
        switch(pageId) {
            case 'dashboard':
                renderDashboardMetrics();
                break;
            case 'subjects':
                renderSubjects();
                break;
            case 'courses':
                renderCourses();
                break;
            case 'schedule':
                renderSchedule();
                break;
            case 'planner':
                renderExams();
                break;
            case 'pomodoro':
                renderPomodoroAssignments();
                break;
        }
    }

    darkModeToggle.addEventListener('change', () => {
        document.documentElement.classList.toggle('dark');
        renderDashboardMetrics(); // Re-render chart with new theme
    });

    // --- EVENT DELEGATION ---
    document.body.addEventListener('click', handleGlobalClick);
    document.body.addEventListener('change', handleGlobalChange);

    async function handleGlobalClick(e) {
        const target = e.target.closest('button, a, .modal, .close-modal, .flashcard');
        if (!target) return;

        const id = target.id;
        const classList = target.classList;

        if (classList.contains('modal') || target.closest('.close-modal')) {
            target.closest('.modal').style.display = 'none';
            return;
        }

        const actions = {
            'addSubjectBtn': addSubject,
            'addExamBtn': addExam,
            'addMistakeBtn': openMistakeModal,
            'saveMistakeBtn': saveMistake,
            'addCourseBtn': openCourseModal,
            'saveCourseBtn': saveCourse,
            'addCustomEventBtn': openCustomEventModal,
            'saveCustomEventBtn': saveCustomEvent,
            'flipFlashcard': () => document.querySelector('.flashcard').classList.toggle('is-flipped'),
            'prevFlashcard': () => navigateFlashcard(-1),
            'nextFlashcard': () => navigateFlashcard(1),
            'addFlashcardBtn': addFlashcard,
            'startStopBtn': () => isRunning ? stopTimer() : startTimer(),
            'resetTimerBtn': resetTimer,
            'skipBtn': () => switchMode(true),
        };

        if (actions[id]) {
            actions[id]();
        } else if (classList.contains('add-lecture')) {
            addLecture(target.dataset.subjectId);
        } else if (target.closest('.open-flashcards')) {
            const subjectId = target.closest('[data-subject-id]').dataset.subjectId;
            const lectureId = target.closest('[data-lecture-id]').dataset.lectureId;
            openFlashcardModal(subjectId, lectureId);
        }
    }

    function handleGlobalChange(e) {
        const target = e.target;
        if (target.closest('.lecture-table-input')) {
            updateLecture(target);
        }
    }

    // --- MASTER RENDER FUNCTION ---
    function renderAll() {
        loadPageData('dashboard');
        loadPageData('subjects');
        loadPageData('courses');
        loadPageData('schedule');
        loadPageData('planner');
        loadPageData('pomodoro');
    }

    // --- RENDER FUNCTIONS ---
    async function renderDashboardMetrics() {
        const data = await apiRequest('/api/dashboard_metrics');
        
        // Pomodoro
        document.getElementById('pomodoroDaily').textContent = formatTime(data.pomodoro.daily, true);
        document.getElementById('pomodoroWeekly').textContent = formatTime(data.pomodoro.weekly, true);
        document.getElementById('pomodoroMonthly').textContent = formatTime(data.pomodoro.monthly, true);
        
        // Exams
        const examContainer = document.getElementById('examCountdownContainer');
        examContainer.innerHTML = '';
        if (data.exams.length === 0) {
            examContainer.innerHTML = '<p class="text-gray-400">No upcoming exams.</p>';
        } else {
            data.exams.forEach(exam => {
                const diffDays = Math.ceil((new Date(exam.date) - new Date()) / (1000 * 60 * 60 * 24));
                examContainer.innerHTML += `<div class="mb-2"><p><strong>${exam.name}</strong> is in <span class="text-blue-400 font-bold">${diffDays > 0 ? diffDays : 0} days</span></p></div>`;
            });
        }
        
        // Weak Topics
        const weakTopicsList = document.getElementById('weakTopicsList');
        weakTopicsList.innerHTML = '';
        if(data.weak_topics.length === 0) {
            weakTopicsList.innerHTML = '<li>No mistakes logged.</li>';
        } else {
            data.weak_topics.forEach(m => {
                weakTopicsList.innerHTML += `<li>${m.topic} (${m.subject_name})</li>`;
            });
        }

        renderWeeklyChart(); // Placeholder data for now
    }

    function renderWeeklyChart() {
        const ctx = document.getElementById('weeklyStudyChart').getContext('2d');
        const isDark = document.documentElement.classList.contains('dark');
        const gridColor = isDark ? '#4a5568' : '#e2e8f0';
        const textColor = isDark ? '#a0aec0' : '#4a5568';
        const data = {
            labels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            datasets: [{
                label: 'Study Hours',
                data: Array(7).fill(0).map(() => Math.random() * 5), // Replace with real data
                backgroundColor: '#38bdf8',
                borderRadius: 5
            }]
        };
        if (weeklyChart) weeklyChart.destroy();
        weeklyChart = new Chart(ctx, {
            type: 'bar',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Hours Studied', color: textColor }, grid: { color: gridColor }, ticks: { color: textColor } },
                    x: { grid: { display: false }, ticks: { color: textColor } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    async function renderSubjects() {
        const subjects = await apiRequest('/api/subjects');
        const container = document.getElementById('subjectsContainer');
        container.innerHTML = '';
        if (subjects.length === 0) {
            container.innerHTML = '<p class="text-gray-400">No subjects added yet. Add one above!</p>';
            return;
        }
        subjects.forEach(s => {
            const el = document.createElement('div');
            el.className = 'bg-gray-800 p-6 rounded-lg';
            const lecturesHtml = s.lectures.map(l => `
                <tr>
                    <td class="p-2">${l.lecture_number}</td>
                    <td class="p-2"><input type="number" value="${l.uni_lecs}" class="w-16 bg-gray-700 p-1 rounded lecture-table-input" data-type="uni_lecs" data-lecture-id="${l.id}"></td>
                    <td class="p-2"><input type="number" value="${l.studied}" class="w-16 bg-gray-700 p-1 rounded lecture-table-input" data-type="studied" data-lecture-id="${l.id}"></td>
                    <td class="p-2">
                        <label class="toggle-switch">
                            <input type="checkbox" ${l.revised ? 'checked' : ''} class="lecture-table-input" data-type="revised" data-lecture-id="${l.id}">
                            <span class="slider"></span>
                        </label>
                    </td>
                    <td class="p-2">
                        <button class="text-blue-400 open-flashcards" data-subject-id="${s.id}" data-lecture-id="${l.lecture_number}">
                            <i class="fas fa-clone"></i>
                        </button>
                    </td>
                </tr>`).join('');

            el.innerHTML = `
                <h2 class="text-xl font-semibold mb-4">${s.name}</h2>
                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead><tr><th>Lec#</th><th>Univ.</th><th>Studied</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody>${lecturesHtml}</tbody>
                    </table>
                </div>
                <button class="mt-4 text-sm text-blue-400 add-lecture" data-subject-id="${s.id}">+ Add Lecture</button>`;
            container.appendChild(el);
        });
    }
    
    async function addSubject() {
        const input = document.getElementById('newSubjectInput');
        const name = input.value.trim();
        if (name) {
            await apiRequest('/api/subjects', 'POST', { name });
            input.value = '';
            renderSubjects();
            renderPomodoroAssignments();
        }
    }

    async function addLecture(subjectId) {
        await apiRequest(`/api/subjects/${subjectId}/lectures`, 'POST');
        renderSubjects();
        renderPomodoroAssignments();
    }

    async function updateLecture(target) {
        const lectureId = target.dataset.lectureId;
        const type = target.dataset.type;
        const value = target.type === 'checkbox' ? target.checked : parseInt(target.value);
        
        const row = target.closest('tr');
        const uniLecs = row.querySelector('[data-type="uni_lecs"]').value;
        const studied = row.querySelector('[data-type="studied"]').value;
        const revised = row.querySelector('[data-type="revised"]').checked;

        await apiRequest(`/api/lectures/${lectureId}`, 'PUT', {
            uni_lecs: parseInt(uniLecs),
            studied: parseInt(studied),
            revised: revised
        });
        // No full re-render needed, but could add visual feedback
    }

    async function renderExams() {
        const exams = await apiRequest('/api/exams');
        // This is also rendered on the dashboard, so this could be optimized
        // For now, we'll just re-render the planner part
        generateReverseSchedule();
    }

    async function addExam() {
        const nameInput = document.getElementById('examNameInput');
        const dateInput = document.getElementById('examDateInput');
        if (nameInput.value && dateInput.value) {
            await apiRequest('/api/exams', 'POST', { name: nameInput.value, date: dateInput.value });
            nameInput.value = '';
            dateInput.value = '';
            renderDashboardMetrics(); // Update countdown
            generateReverseSchedule();
        }
    }

    async function generateReverseSchedule() {
        const container = document.getElementById('reverseScheduleContainer');
        const exams = await apiRequest('/api/exams');
        const subjects = await apiRequest('/api/subjects');
        
        if (exams.length === 0) {
            container.innerHTML = '<p class="text-gray-400">Add an exam to generate a schedule.</p>';
            return;
        }

        const upcomingExam = exams[0];
        const daysUntilExam = Math.ceil((new Date(upcomingExam.date) - new Date()) / (1000 * 60 * 60 * 24));
        const totalLecturesToStudy = subjects.reduce((sum, s) => sum + s.lectures.reduce((lecSum, l) => lecSum + (l.uni_lecs - l.studied), 0), 0);
        const lecturesPerDay = totalLecturesToStudy > 0 && daysUntilExam > 3 ? (totalLecturesToStudy / (daysUntilExam - 3)).toFixed(1) : 0;
        
        container.innerHTML = `<h3 class="font-semibold text-lg">${upcomingExam.name} Plan</h3><p>Study <strong class="text-blue-400">${lecturesPerDay} lectures per day</strong>.</p>`;
    }
    
    async function openMistakeModal() {
        const subjects = await apiRequest('/api/subjects');
        let selectHTML = '<option value="">Select Subject</option>';
        subjects.forEach(s => selectHTML += `<option value="${s.id}">${s.name}</option>`);
        document.getElementById('mistakeModal').innerHTML = `
            <div class="modal-content">
                <span class="close-modal absolute top-4 right-6 text-2xl font-bold cursor-pointer">&times;</span>
                <h2 class="text-xl font-bold mb-4">Log Mistake</h2>
                <div class="space-y-4">
                    <input type="text" id="mistakeTopicInput" placeholder="Topic" class="bg-gray-700 w-full p-2 rounded">
                    <textarea id="mistakeDescriptionInput" placeholder="Description" class="bg-gray-700 w-full p-2 rounded h-24"></textarea>
                    <select id="mistakeSubjectSelect" class="bg-gray-700 w-full p-2 rounded">${selectHTML}</select>
                    <button id="saveMistakeBtn" class="w-full bg-blue-600 p-2 rounded">Save</button>
                </div>
            </div>`;
        document.getElementById('mistakeModal').style.display = 'block';
    }

    async function saveMistake() {
        const topic = document.getElementById('mistakeTopicInput').value.trim();
        const description = document.getElementById('mistakeDescriptionInput').value.trim();
        const subjectId = parseInt(document.getElementById('mistakeSubjectSelect').value);
        if (topic && description && subjectId) {
            await apiRequest('/api/mistakes', 'POST', { topic, description, subject_id: subjectId });
            document.getElementById('mistakeModal').style.display = 'none';
            renderDashboardMetrics();
        }
    }

    // --- POMODORO ---
    let timerInterval, isRunning = false, timeLeft = 1500, currentMode = 'pomodoro', sessionCount = 1;
    const modes = { pomodoro: { time: 1500, status: 'Stay Focused' }, shortBreak: { time: 300, status: 'Short Break' }, longBreak: { time: 900, status: 'Long Break' } };

    function updateTimerDisplay() {
        const timerDisplay = document.getElementById('timer');
        if (!timerDisplay) return;
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        const totalSeconds = modes[currentMode].time;
        const percentage = ((totalSeconds - timeLeft) / totalSeconds) * 360;
        document.getElementById('pomodoroDial').style.background = `conic-gradient(#38bdf8 ${percentage}deg, #2d3748 ${percentage}deg)`;
    }

    function startTimer() {
        if (isRunning) return;
        isRunning = true;
        document.getElementById('startStopBtn').innerHTML = '<i class="fas fa-pause"></i>';
        timerInterval = setInterval(() => {
            timeLeft--;
            updateTimerDisplay();
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                if (currentMode === 'pomodoro') {
                    logPomodoroSession();
                }
                switchMode();
            }
        }, 1000);
    }

    function stopTimer() {
        if (!isRunning) return;
        isRunning = false;
        document.getElementById('startStopBtn').innerHTML = '<i class="fas fa-play"></i>';
        clearInterval(timerInterval);
    }

    function resetTimer() {
        stopTimer();
        timeLeft = modes[currentMode].time;
        updateTimerDisplay();
    }

    function switchMode(forceNext = false) {
        stopTimer();
        if (currentMode === 'pomodoro') {
            if (!forceNext) sessionCount++;
            currentMode = sessionCount % 4 === 0 ? 'longBreak' : 'shortBreak';
        } else {
            currentMode = 'pomodoro';
        }
        timeLeft = modes[currentMode].time;
        document.getElementById('timer-status').textContent = modes[currentMode].status;
        document.getElementById('session-tracker').textContent = `${Math.ceil(sessionCount/2)} / 4 Sessions`;
        updateTimerDisplay();
    }

    async function logPomodoroSession() {
        const duration = modes.pomodoro.time;
        const assigned = document.getElementById('pomodoroSubjectAssign').value;
        let [subjectId, lectureId] = assigned ? assigned.split('-').map(Number) : [null, null];
        
        await apiRequest('/api/pomodoro', 'POST', {
            duration,
            subject_id: subjectId,
            lecture_id: lectureId
        });
        renderDashboardMetrics();
    }

    async function renderPomodoroAssignments() {
        const subjects = await apiRequest('/api/subjects');
        const select = document.getElementById('pomodoroSubjectAssign');
        select.innerHTML = '<option value="">Assign to lecture...</option>';
        subjects.forEach(s => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = s.name;
            s.lectures.forEach(l => {
                optgroup.innerHTML += `<option value="${s.id}-${l.lecture_number}">Lecture ${l.lecture_number}</option>`;
            });
            select.appendChild(optgroup);
        });
    }
    
    // --- Flashcards ---
    async function openFlashcardModal(subjectId, lectureId) {
        const subject = (await apiRequest('/api/subjects')).find(s => s.id == subjectId);
        const cards = await apiRequest(`/api/subjects/${subjectId}/lectures/${lectureId}/flashcards`);
        
        currentFlashcardState = { subjectId, lectureId, cards, currentIndex: 0 };
        
        document.getElementById('flashcardModal').innerHTML = `
            <div class="modal-content">
                <span class="close-modal absolute top-4 right-6 text-2xl font-bold cursor-pointer">&times;</span>
                <h2 class="text-xl font-bold mb-4">Flashcards for ${subject.name} - Lec ${lectureId}</h2>
                <div class="mb-4">
                    <div class="flashcard"><div class="flashcard-inner">
                        <div class="flashcard-front"><p id="flashcard-front-content"></p></div>
                        <div class="flashcard-back"><p id="flashcard-back-content"></p></div>
                    </div></div>
                </div>
                <div class="flex justify-between items-center mb-4">
                    <button id="prevFlashcard" class="bg-gray-600 p-2 rounded"><i class="fas fa-arrow-left"></i></button>
                    <span id="flashcardCounter"></span>
                    <button id="nextFlashcard" class="bg-gray-600 p-2 rounded"><i class="fas fa-arrow-right"></i></button>
                </div>
                <button id="flipFlashcard" class="w-full bg-blue-600 p-2 rounded mb-4">Flip</button>
                <div class="flex gap-4">
                    <input type="text" id="newFlashcardFront" placeholder="Front" class="bg-gray-700 w-1/2 p-2 rounded">
                    <input type="text" id="newFlashcardBack" placeholder="Back" class="bg-gray-700 w-1/2 p-2 rounded">
                </div>
                <button id="addFlashcardBtn" class="w-full mt-4 bg-green-600 p-2 rounded">Add Card</button>
            </div>`;
        renderFlashcard();
        document.getElementById('flashcardModal').style.display = 'block';
    }

    function renderFlashcard() {
        const { cards, currentIndex } = currentFlashcardState;
        const modal = document.getElementById('flashcardModal');
        modal.querySelector('.flashcard').classList.remove('is-flipped');
        if (cards.length === 0) {
            modal.querySelector('#flashcard-front-content').textContent = 'No cards yet.';
            modal.querySelector('#flashcard-back-content').textContent = 'Add one!';
            modal.querySelector('#flashcardCounter').textContent = '0 / 0';
        } else {
            const card = cards[currentIndex];
            modal.querySelector('#flashcard-front-content').textContent = card.front;
            modal.querySelector('#flashcard-back-content').textContent = card.back;
            modal.querySelector('#flashcardCounter').textContent = `${currentIndex + 1} / ${cards.length}`;
        }
    }
    
    function navigateFlashcard(direction) {
        const { cards } = currentFlashcardState;
        if (cards.length > 0) {
            currentFlashcardState.currentIndex = (currentFlashcardState.currentIndex + direction + cards.length) % cards.length;
            renderFlashcard();
        }
    }

    async function addFlashcard() {
        const modal = document.getElementById('flashcardModal');
        const front = modal.querySelector('#newFlashcardFront').value.trim();
        const back = modal.querySelector('#newFlashcardBack').value.trim();
        const { subjectId, lectureId } = currentFlashcardState;
        if (front && back) {
            await apiRequest('/api/flashcards', 'POST', { subject_id: subjectId, lecture_id: lectureId, front, back });
            openFlashcardModal(subjectId, lectureId); // Re-open to refresh
        }
    }
    
    // --- Courses ---
    async function renderCourses() {
        const courses = await apiRequest('/api/courses');
        const container = document.getElementById('courseLibraryContainer');
        container.innerHTML = '';
        if (courses.length === 0) {
            container.innerHTML = '<p class="text-gray-400 md:col-span-2">No courses added.</p>';
            return;
        }
        courses.forEach(c => {
            const progress = c.total_units > 0 ? (c.completed_units / c.total_units) * 100 : 0;
            container.innerHTML += `
                <div class="bg-gray-700 p-4 rounded-lg">
                    <h3 class="font-bold">${c.title}</h3>
                    <p class="text-sm text-gray-400">${c.platform} - ${c.category}</p>
                    <div class="mt-3">
                        <div class="flex justify-between text-sm mb-1">
                            <span>Progress</span><span>${Math.round(progress)}%</span>
                        </div>
                        <div class="w-full bg-gray-600 rounded-full h-2.5">
                            <div class="bg-blue-500 h-2.5 rounded-full" style="width: ${progress}%"></div>
                        </div>
                        <p class="text-xs text-gray-500 mt-1">${c.completed_units}/${c.total_units} units</p>
                    </div>
                </div>`;
        });
    }

    function openCourseModal() {
        document.getElementById('courseModal').innerHTML = `
            <div class="modal-content">
                <span class="close-modal absolute top-4 right-6 text-2xl font-bold cursor-pointer">&times;</span>
                <h2 class="text-xl font-bold mb-4">Add Course</h2>
                <div class="space-y-4">
                    <input type="text" id="courseTitleInput" placeholder="Title" class="bg-gray-700 w-full p-2 rounded">
                    <div class="grid grid-cols-2 gap-4">
                        <input type="text" id="coursePlatformInput" placeholder="Platform" class="bg-gray-700 w-full p-2 rounded">
                        <input type="text" id="courseCategoryInput" placeholder="Category" class="bg-gray-700 w-full p-2 rounded">
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <input type="number" id="courseTotalUnitsInput" placeholder="Total Units" class="bg-gray-700 w-full p-2 rounded">
                        <input type="number" id="courseCompletedUnitsInput" placeholder="Completed Units" class="bg-gray-700 w-full p-2 rounded">
                    </div>
                    <div><label class="text-sm">Target Date</label><input type="date" id="courseTargetDateInput" class="bg-gray-700 w-full p-2 rounded"></div>
                    <input type="number" id="courseSessionsWeekInput" placeholder="Target Sessions/Week" class="bg-gray-700 w-full p-2 rounded">
                    <button id="saveCourseBtn" class="w-full bg-blue-600 p-2 rounded">Save</button>
                </div>
            </div>`;
        document.getElementById('courseModal').style.display = 'block';
    }

    async function saveCourse() {
        const modal = document.getElementById('courseModal');
        const data = {
            title: modal.querySelector('#courseTitleInput').value,
            platform: modal.querySelector('#coursePlatformInput').value,
            category: modal.querySelector('#courseCategoryInput').value,
            total_units: parseInt(modal.querySelector('#courseTotalUnitsInput').value) || 0,
            completed_units: parseInt(modal.querySelector('#courseCompletedUnitsInput').value) || 0,
            target_date: modal.querySelector('#courseTargetDateInput').value,
            sessions_per_week: parseInt(modal.querySelector('#courseSessionsWeekInput').value) || 1
        };
        await apiRequest('/api/courses', 'POST', data);
        modal.style.display = 'none';
        renderCourses();
    }
    
    // --- Schedule ---
    async function renderSchedule() {
        const events = await apiRequest('/api/schedule');
        const container = document.getElementById('timeline-container');
        if (!container) return;
        container.innerHTML = '';
        for (let i = 0; i < 24; i++) {
            container.innerHTML += `<div class="timeline-hour"><span class="timeline-hour-label">${i.toString().padStart(2, '0')}:00</span></div>`;
        }
        
        events.forEach(e => {
            const startMinutes = timeToMinutes(e.start_time);
            const endMinutes = timeToMinutes(e.end_time);
            const duration = endMinutes - startMinutes;
            container.innerHTML += `
                <div class="timeline-event" style="top:${startMinutes}px; height:${duration}px; background-color:rgba(${getColor(e.color)}, 0.5); border-color:rgb(${getColor(e.color)});">
                    <p class="font-bold">${e.title}</p>
                </div>`;
        });
    }
    
    function openCustomEventModal() {
        document.getElementById('customEventModal').innerHTML = `
            <div class="modal-content">
                <span class="close-modal absolute top-4 right-6 text-2xl font-bold cursor-pointer">&times;</span>
                <h2 class="text-xl font-bold mb-4">Add Custom Event</h2>
                <div class="space-y-4">
                    <input type="text" id="customEventTitle" placeholder="Title" class="bg-gray-700 w-full p-2 rounded">
                    <div class="grid grid-cols-2 gap-4">
                        <div><label class="text-sm">Start</label><input type="time" id="customEventStart" class="bg-gray-700 w-full p-2 rounded"></div>
                        <div><label class="text-sm">End</label><input type="time" id="customEventEnd" class="bg-gray-700 w-full p-2 rounded"></div>
                    </div>
                    <div>
                        <label class="text-sm">Color</label>
                        <select id="customEventColor" class="bg-gray-700 w-full p-2 rounded">
                            <option value="purple">Purple</option><option value="yellow">Yellow</option><option value="teal">Teal</option>
                        </select>
                    </div>
                    <button id="saveCustomEventBtn" class="w-full bg-blue-600 p-2 rounded">Save</button>
                </div>
            </div>`;
        document.getElementById('customEventModal').style.display = 'block';
    }

    async function saveCustomEvent() {
        const modal = document.getElementById('customEventModal');
        const data = {
            title: modal.querySelector('#customEventTitle').value,
            start_time: modal.querySelector('#customEventStart').value,
            end_time: modal.querySelector('#customEventEnd').value,
            color: modal.querySelector('#customEventColor').value
        };
        if (data.title && data.start_time && data.end_time) {
            await apiRequest('/api/schedule', 'POST', data);
            modal.style.display = 'none';
            renderSchedule();
        }
    }


    // --- UTILITY FUNCTIONS ---
    function formatTime(seconds, short = false) {
        if (isNaN(seconds) || seconds < 0) return "0m";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return short ? `${h}h ${m}m` : `${h}h ${m}m`;
    }

    function getColor(colorName) {
        const colors = { red: '248, 113, 113', green: '74, 222, 128', blue: '96, 165, 250', indigo: '129, 140, 248', purple: '167, 139, 250', yellow: '250, 204, 21', teal: '45, 212, 191' };
        return colors[colorName] || colors.blue;
    }

    function timeToMinutes(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }

    // --- INITIALIZATION ---
    setupNavigation();
    renderAll();
    updateTimerDisplay();
});
