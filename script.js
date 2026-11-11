// Globale Variablen für Benutzerdaten
let participantName = "";
let returnToStartTimer;
let answerSubmissionLocked = false;

const entriesDatabaseName = 'mv-lyra-contest';
const entriesStoreName = 'entries';

if (navigator.storage?.persist) {
    navigator.storage.persist().catch((error) => console.warn('Persistente Speicherung konnte nicht angefordert werden.', error));
}

// Element-Referenzen
const curtainsWrapper = document.getElementById('curtainsWrapper');
const oscarCard = document.querySelector('.oscar-card');
const leftCurtain = document.querySelector('.curtain-left');
const stage1 = document.getElementById('stage1');
const stage2 = document.getElementById('stage2');
const stage3 = document.getElementById('stage3');
const userNameInput = document.getElementById('userName');
const userAnswerInput = document.getElementById('userAnswer');
const displayName = document.getElementById('displayName');
const errorToast1 = document.getElementById('errorToast1');
const errorToast2 = document.getElementById('errorToast2');
const returnHomeButton = document.getElementById('returnHomeButton');
const answerSubmitButton = document.querySelector('#questionForm button[type="submit"]');

returnHomeButton.addEventListener('click', resetToStart);

function resetToStart() {
    clearTimeout(returnToStartTimer);
    answerSubmissionLocked = false;
    answerSubmitButton.disabled = false;
    oscarCard.classList.add('is-hidden');

    const hideCard = (event) => {
        if (event.target !== oscarCard || event.propertyName !== 'opacity') return;
        oscarCard.removeEventListener('transitionend', hideCard);

        participantName = "";
        stage1.classList.remove('active');
        stage1.style.display = 'block';
        stage2.classList.remove('active');
        stage2.style.display = 'none';
        stage3.classList.remove('active');
        stage3.style.display = 'none';
        userNameInput.value = "";
        userAnswerInput.value = "";
        displayName.textContent = 'Gast';
        document.getElementById('summaryName').textContent = '-';
        document.getElementById('summaryAnswer').textContent = '-';
        errorToast1.style.display = 'none';
        errorToast2.style.display = 'none';

        const showCard = (curtainEvent) => {
            if (curtainEvent.target !== leftCurtain || curtainEvent.propertyName !== 'transform') return;
            leftCurtain.removeEventListener('transitionend', showCard);
            stage1.classList.add('active');
            oscarCard.classList.remove('is-hidden');
        };

        leftCurtain.addEventListener('transitionend', showCard);
        curtainsWrapper.classList.remove('open');
    };

    oscarCard.addEventListener('transitionend', hideCard);
}

/**
 * Schritt 1: Startet die Vorhang-Öffnung und wechselt auf die Hauptbühne
 */
function startShow() {
    const nameVal = userNameInput.value.trim();

    if (!nameVal) {
        showToast(errorToast1);
        return;
    }

    participantName = nameVal;
    displayName.textContent = participantName;

    // 1. Vorhang aufziehen (CSS Animation 2.4s)
    curtainsWrapper.classList.add('open');

    const hideWelcomeStage = (event) => {
        if (event.target !== oscarCard || event.propertyName !== 'opacity') return;
        stage1.classList.remove('active');
        oscarCard.removeEventListener('transitionend', hideWelcomeStage);
    };

    oscarCard.addEventListener('transitionend', hideWelcomeStage);
    oscarCard.classList.add('is-hidden');

    // 2. Weiche Transition der Inhaltskarte
    setTimeout(() => {
        stage1.style.display = 'none';
        stage2.style.display = 'block';
        oscarCard.classList.remove('is-hidden');
        // Erneuter Aufruf für Smooth Fade-In
        setTimeout(() => stage2.classList.add('active'), 50);
    }, 1000);
}

/**
 * Schritt 2: Antwort speichern und Golden Ticket anzeigen
 */
async function submitAnswer() {
    const answerVal = userAnswerInput.value.trim();

    if (!answerVal) {
        showToast(errorToast2);
        return;
    }

    if (answerSubmissionLocked) return;
    answerSubmissionLocked = true;
    answerSubmitButton.disabled = true;

    try {
        await saveEntry({
            name: participantName,
            answer: answerVal,
            submittedAt: new Date().toISOString()
        });
    } catch (error) {
        answerSubmissionLocked = false;
        answerSubmitButton.disabled = false;
        errorToast2.textContent = 'Speichern fehlgeschlagen. Bitte versuche es erneut.';
        showToast(errorToast2);
        console.error('Teilnahme konnte nicht gespeichert werden.', error);
        return;
    }

    // Ticket Zusammenfassung aktualisieren
    document.getElementById('summaryName').textContent = participantName;
    document.getElementById('summaryAnswer').textContent = answerVal;

    // Transition zu Stage 3
    stage2.classList.remove('active');

    setTimeout(() => {
        stage2.style.display = 'none';
        stage3.style.display = 'block';
        setTimeout(() => {
            stage3.classList.add('active');
            triggerGoldConfetti();
            returnToStartTimer = setTimeout(resetToStart, 10000);
        }, 50);
    }, 500);
}

function saveEntry(entry) {
    return new Promise((resolve, reject) => {
        const openRequest = indexedDB.open(entriesDatabaseName, 1);

        openRequest.onupgradeneeded = () => {
            openRequest.result.createObjectStore(entriesStoreName, {
                keyPath: 'id',
                autoIncrement: true
            });
        };

        openRequest.onerror = () => reject(openRequest.error);
        openRequest.onsuccess = () => {
            const database = openRequest.result;
            const transaction = database.transaction(entriesStoreName, 'readwrite');
            transaction.objectStore(entriesStoreName).add(entry);
            transaction.oncomplete = () => {
                database.close();
                resolve();
            };
            transaction.onabort = () => {
                database.close();
                reject(transaction.error || new Error('IndexedDB-Transaktion abgebrochen.'));
            };
        };
    });
}

/**
 * Fehlerhinweis ohne alert() anzeigen
 */
function showToast(toastElem) {
    toastElem.style.display = 'block';
    setTimeout(() => {
        toastElem.style.display = 'none';
    }, 3500);
}

/**
 * Goldener Konfetti-Regen beim Gewinnspiel-Abschluss
 */
function triggerGoldConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const particleCount = 75;
    const colors = ['#fff0ad', '#d4af37', '#997a15', '#ffffff', '#ff4d6d'];

    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            size: Math.random() * 8 + 4,
            speedY: Math.random() * 3 + 2,
            speedX: Math.random() * 2 - 1,
            color: colors[Math.floor(Math.random() * colors.length)],
            rotation: Math.random() * 360,
            rotSpeed: Math.random() * 4 - 2
        });
    }

    function animateConfetti() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let activeParticles = 0;

        particles.forEach(p => {
            p.y += p.speedY;
            p.x += p.speedX;
            p.rotation += p.rotSpeed;

            if (p.y < canvas.height) {
                activeParticles++;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
                ctx.restore();
            }
        });

        if (activeParticles > 0) {
            requestAnimationFrame(animateConfetti);
        }
    }

    animateConfetti();
}

// Window Resize Handler für Canvas
window.addEventListener('resize', () => {
    const canvas = document.getElementById('confetti-canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});