// Globale Variablen für Benutzerdaten
let participantName = "";
let returnToStartTimer;
let stage2InactivityTimer;
let answerSubmissionLocked = false;

const entriesDatabaseName = 'mv-lyra-contest';
const entriesStoreName = 'entries';
const evaluationPin = '1924';
let evaluationInProgress = false;

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
const errorToast2 = document.getElementById('errorToast2');
const returnHomeButton = document.getElementById('returnHomeButton');
const backToStartButton = document.getElementById('backToStartButton');
const answerSubmitButton = document.querySelector('#questionForm button[type="submit"]');
const evaluationLaunchButton = document.getElementById('evaluationLaunchButton');
const evaluationDialog = document.getElementById('evaluationDialog');
const evaluationForm = document.getElementById('evaluationForm');
const evaluationPinInput = document.getElementById('evaluationPinInput');
const evaluationError = document.getElementById('evaluationError');
const cancelEvaluationButton = document.getElementById('cancelEvaluationButton');
const winnerDialog = document.getElementById('winnerDialog');
const winnerStatus = document.getElementById('winnerStatus');
const winnerName = document.getElementById('winnerName');
const winnerDetails = document.getElementById('winnerDetails');
const winnerParticipantCount = document.getElementById('winnerParticipantCount');
const closeWinnerButton = document.getElementById('closeWinnerButton');
const winnerHomeButton = document.getElementById('winnerHomeButton');

returnHomeButton.addEventListener('click', resetToStart);
backToStartButton.addEventListener('click', resetToStart);
['input', 'keydown', 'pointerdown'].forEach(eventName => {
    stage2.addEventListener(eventName, resetStage2InactivityTimer);
});
evaluationLaunchButton.addEventListener('click', () => {
    evaluationError.hidden = true;
    evaluationForm.reset();
    evaluationDialog.showModal();
});
cancelEvaluationButton.addEventListener('click', () => evaluationDialog.close());
evaluationForm.addEventListener('submit', runEvaluation);
closeWinnerButton.addEventListener('click', () => winnerDialog.close());
winnerHomeButton.addEventListener('click', () => winnerDialog.close());
winnerDialog.addEventListener('close', () => {
    evaluationLaunchButton.hidden = false;
});

function resetToStart() {
    clearTimeout(stage2InactivityTimer);
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
        document.getElementById('summaryName').textContent = '-';
        document.getElementById('summaryAnswer').textContent = '-';
        errorToast2.style.display = 'none';

        const showCard = (curtainEvent) => {
            if (curtainEvent.target !== leftCurtain || curtainEvent.propertyName !== 'transform') return;
            leftCurtain.removeEventListener('transitionend', showCard);
            stage1.classList.add('active');
            evaluationLaunchButton.hidden = false;
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
    evaluationLaunchButton.hidden = true;

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
        setTimeout(() => {
            stage2.classList.add('active');
            resetStage2InactivityTimer();
        }, 50);
    }, 1000);
}

function resetStage2InactivityTimer() {
    clearTimeout(stage2InactivityTimer);
    stage2InactivityTimer = setTimeout(resetToStart, 15000);
}

/**
 * Schritt 2: Antwort speichern und Golden Ticket anzeigen
 */
async function submitAnswer() {
    const nameVal = userNameInput.value.trim();
    const answerVal = userAnswerInput.value.trim();

    if (!nameVal || !answerVal) {
        showToast(errorToast2);
        return;
    }

    if (answerSubmissionLocked) return;
    clearTimeout(stage2InactivityTimer);
    participantName = nameVal;
    answerSubmissionLocked = true;
    answerSubmitButton.disabled = true;

    try {
        const entries = await loadEntries();
        const normalizedName = participantName.toLocaleLowerCase('de-DE');
        const nameExists = entries.some(entry =>
            typeof entry.name === 'string'
            && entry.name.trim().toLocaleLowerCase('de-DE') === normalizedName
        );

        if (nameExists) {
            answerSubmissionLocked = false;
            answerSubmitButton.disabled = false;
            errorToast2.textContent = 'Dieser Name existiert bereits. Bitte wähle einen anderen Namen.';
            showToast(errorToast2);
            resetStage2InactivityTimer();
            return;
        }

        await saveEntry({
            name: participantName,
            answer: answerVal,
            submittedAt: new Date().toISOString()
        });
    } catch (error) {
        answerSubmissionLocked = false;
        answerSubmitButton.disabled = false;
        resetStage2InactivityTimer();
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
            returnToStartTimer = setTimeout(resetToStart, 4000);
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

async function runEvaluation(event) {
    event.preventDefault();
    if (evaluationInProgress) return;

    if (evaluationPinInput.value.trim() !== evaluationPin) {
        evaluationError.textContent = 'Der Pincode ist nicht korrekt.';
        evaluationError.hidden = false;
        evaluationPinInput.focus();
        return;
    }

    const correctAnswer = Number(document.querySelector('meta[name="contest-correct-answer"]').content);

    evaluationInProgress = true;
    const evaluationSubmitButton = evaluationForm.querySelector('button[type="submit"]');
    evaluationSubmitButton.disabled = true;

    try {
        const entries = await loadEntries();
        const validEntries = entries
            .filter(entry => typeof entry.name === 'string' && entry.name.trim() && entry.answer !== '')
            .map(entry => ({ name: entry.name.trim(), answer: Number(entry.answer) }))
            .filter(entry => Number.isInteger(entry.answer) && entry.answer >= 0);

        showWinner(validEntries, correctAnswer, entries.length);
        evaluationDialog.close();
        evaluationLaunchButton.hidden = true;
        winnerDialog.showModal();
    } catch (error) {
        evaluationError.textContent = 'Die Teilnahmen konnten nicht geladen werden. Bitte versuche es erneut.';
        evaluationError.hidden = false;
        console.error('Auswertung konnte nicht geladen werden.', error);
    } finally {
        evaluationInProgress = false;
        evaluationSubmitButton.disabled = false;
    }
}

function loadEntries() {
    return new Promise((resolve, reject) => {
        const openRequest = indexedDB.open(entriesDatabaseName, 1);

        openRequest.onupgradeneeded = () => {
            const database = openRequest.result;
            if (!database.objectStoreNames.contains(entriesStoreName)) {
                database.createObjectStore(entriesStoreName, {
                    keyPath: 'id',
                    autoIncrement: true
                });
            }
        };

        openRequest.onerror = () => reject(openRequest.error);
        openRequest.onsuccess = () => {
            const database = openRequest.result;
            if (!database.objectStoreNames.contains(entriesStoreName)) {
                database.close();
                resolve([]);
                return;
            }

            const transaction = database.transaction(entriesStoreName, 'readonly');
            let entries = [];
            const request = transaction.objectStore(entriesStoreName).getAll();
            request.onsuccess = () => {
                entries = request.result || [];
            };
            transaction.oncomplete = () => {
                database.close();
                resolve(entries);
            };
            transaction.onerror = () => {
                database.close();
                reject(transaction.error || new Error('IndexedDB-Lesevorgang fehlgeschlagen.'));
            };
        };
    });
}

function showWinner(entries, correctAnswer, totalParticipants = entries.length) {
    winnerParticipantCount.textContent = totalParticipants === 1
        ? '1 Person hat teilgenommen.'
        : `${totalParticipants} Personen haben teilgenommen.`;
    winnerName.replaceChildren();

    if (entries.length === 0) {
        winnerStatus.textContent = 'Keine Teilnahmen';
        const emptyItem = document.createElement('li');
        emptyItem.textContent = 'Noch keine gültigen Teilnahmen';
        winnerName.appendChild(emptyItem);
        winnerDetails.textContent = '';
        return;
    }

    const uniqueEntries = [];
    const seenNames = new Set();
    entries.forEach(entry => {
        const normalizedName = entry.name.toLocaleLowerCase('de-DE');
        if (!seenNames.has(normalizedName)) {
            seenNames.add(normalizedName);
            uniqueEntries.push(entry);
        }
    });

    const entriesByDifference = new Map();
    uniqueEntries.forEach(entry => {
        const difference = Math.abs(entry.answer - correctAnswer);
        if (!entriesByDifference.has(difference)) {
            entriesByDifference.set(difference, []);
        }
        entriesByDifference.get(difference).push(entry);
    });

    const rankedEntries = [];
    [...entriesByDifference.entries()]
        .sort(([differenceA], [differenceB]) => differenceA - differenceB)
        .forEach(([, finalists]) => {
            for (let i = finalists.length - 1; i > 0; i--) {
                const randomIndex = Math.floor(Math.random() * (i + 1));
                [finalists[i], finalists[randomIndex]] = [finalists[randomIndex], finalists[i]];
            }
            rankedEntries.push(...finalists);
        });

    const winners = rankedEntries.slice(0, 10);
    winners.forEach(winner => {
        const item = document.createElement('li');
        item.textContent = winner.name;
        winnerName.appendChild(item);
    });

    const exactWinnerCount = winners.filter(winner => winner.answer === correctAnswer).length;
    winnerStatus.textContent = winners.length === 10 ? 'Die 10 Gewinner' : `${winners.length} Gewinner`;
    winnerDetails.textContent = exactWinnerCount > 0
        ? `Richtige Antwort: ${correctAnswer}. ${exactWinnerCount} der ${winners.length} Gewinner ${exactWinnerCount === 1 ? 'hat' : 'haben'} exakt getroffen; die übrigen Plätze wurden nach der nächstliegenden Schätzung ausgelost.`
        : `Richtige Antwort: ${correctAnswer}. Die ${winners.length} nächstliegenden Schätzungen wurden zufällig als Gewinner bestimmt.`;
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