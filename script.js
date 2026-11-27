// --- 1. LES DONNÉES ---
const themes = [
    {
        id: 'zelda',
        nom: 'ZELDA',
        desc: 'Hyrulian Serenity',
        video: 'assets/zelda.mp4',
        poster: 'assets/posters/zelda.jpg',
        musiquesTravail: 20,
        musiquePause: 'assets/pause_zelda.mp3',
        premiereMusique: 3
    },
    {
        id: 'mario',
        nom: 'MARIO',
        desc: 'Mushroom Kingdom',
        video: 'assets/mario.mp4',
        poster: 'assets/posters/mario.jpg',
        musiquesTravail: 20,
        musiquePause: 'assets/pause_mario.mp3',
        premiereMusique: 3
    },
    {
        id: 'eldenring',
        nom: 'ELDEN RING',
        desc: 'Rest in the Lands Between',
        video: 'assets/eldenring.mp4',
        poster: 'assets/posters/eldenring.jpg',
        musiquesTravail: 20,
        musiquePause: 'assets/pause_eldenring.mp3',
        premiereMusique: 3
    },
    {
        id: 'pokemon',
        nom: 'POKÉMON',
        desc: 'Pokémon Center',
        video: 'assets/pokemon.mp4',
        poster: 'assets/posters/pokemon.jpg',
        musiquesTravail: 20,
        musiquePause: 'assets/pause_pokemon.mp3',
        premiereMusique: 2
    },
    {
        id: 'minecraft',
        nom: 'MINECRAFT',
        desc: 'Creativity & Peace',
        video: 'assets/minecraft.mp4',
        poster: 'assets/posters/minecraft.jpg',
        musiquesTravail: 20,
        musiquePause: 'assets/pause_minecraft.mp3',
        premiereMusique: 9 // Jouera minecraft_9.mp3 (Blind Spots) en premier
    }
];

let indexActuel = 0;

const TEMPS_PREPARATION = 5 * 60;
const TEMPS_TRAVAIL = 25 * 60;
const TEMPS_PAUSE = 5 * 60;
const CYCLES_MAX = 4;

let tempsRestant = TEMPS_PREPARATION;
let tempsMaxPhase = TEMPS_PREPARATION;
let finPhase = 0;              // Heure (en ms) à laquelle la phase en cours se termine
let phaseActuelle = 'menu';    // 'menu' | 'preparation' | 'travail' | 'pause' | 'terminee'
let cyclesCompletes = 0;
let timerActif = null;
let enPause = false;
let volumeGlobal = 0.4; // Volume de base à 40%

// --- VARIABLES AUDIO (Le Cerveau) ---
let audioActuel = null;
let playlistTravail = []; // Le paquet de cartes


// --- 2. RÉCUPÉRATION DES ÉLÉMENTS ---
const btnFullscreen = document.getElementById('btn-fullscreen');
const menuScreen = document.getElementById('menu-screen');
const timerScreen = document.getElementById('timer-screen');
const themeTitle = document.getElementById('theme-title');
const themeDesc = document.getElementById('theme-desc');
const timerThemeName = document.getElementById('timer-theme-name');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnQuitter = document.getElementById('btn-quitter');
const btnSkipPrep = document.getElementById('btn-skip-prep');
const btnPause = document.getElementById('btn-pause');
const themeCard = document.getElementById('current-theme-card');
const volumeSlider = document.getElementById('volume-slider');

const bgLayer = document.getElementById('bg-layer');
const affichageTemps = document.getElementById('temps');
const affichageStatus = document.getElementById('status');
const progressBar = document.getElementById('progress-bar');
const prepMessage = document.getElementById('prep-message');

// --- 2.5 FOND VIDÉO SANS ÉCRAN NOIR ---
// Avant : un seul <video> dont on changeait la source → il se vidait (noir) le temps
// de télécharger la nouvelle vidéo. Maintenant : un lecteur par thème, empilés.
// Le nouveau apparaît en fondu PAR-DESSUS l'ancien, et affiche son image "poster"
// tant que la vidéo n'est pas prête. L'ancien reste visible dessous jusqu'à la fin du fondu.
const lecteursVideo = {};
let videoActive = null;
const DUREE_FONDU_VIDEO = 600; // Doit correspondre à la transition CSS de .bg-video

// On précharge les posters (légers) pour qu'ils s'affichent instantanément
themes.forEach(theme => { new Image().src = theme.poster; });

function obtenirLecteurVideo(theme) {
    if (!lecteursVideo[theme.id]) {
        const video = document.createElement('video');
        video.className = 'bg-video';
        video.muted = true;          // Obligatoire pour l'autoplay
        video.loop = true;
        video.playsInline = true;    // Obligatoire sur iPhone
        video.setAttribute('playsinline', '');
        video.preload = 'auto';
        video.poster = theme.poster;
        video.src = theme.video;
        bgLayer.appendChild(video);
        lecteursVideo[theme.id] = video;
    }
    return lecteursVideo[theme.id];
}

function afficherVideo(theme) {
    const nouvelle = obtenirLecteurVideo(theme);
    if (nouvelle === videoActive) return;

    const ancienne = videoActive;
    videoActive = nouvelle;

    // La nouvelle passe au-dessus, l'ancienne reste visible en dessous pendant le fondu
    Object.values(lecteursVideo).forEach(v => { v.style.zIndex = 0; });
    if (ancienne) ancienne.style.zIndex = 1;
    nouvelle.style.zIndex = 2;

    nouvelle.play().catch(() => {});
    nouvelle.classList.add('active');

    if (ancienne) {
        setTimeout(() => {
            if (ancienne !== videoActive) {   // Sécurité si l'utilisateur a recliqué entre-temps
                ancienne.classList.remove('active');
                ancienne.pause();
            }
        }, DUREE_FONDU_VIDEO + 50);
    }
}

function jouerVideo() { if (videoActive) videoActive.play().catch(() => {}); }
function pauserVideo() { if (videoActive) videoActive.pause(); }
function luminositeVideo(valeur) { bgLayer.style.filter = `brightness(${valeur})`; }

// --- 3. LOGIQUE AUDIO MAGIQUE (Fondus & Shuffles) ---

// Fonction mathématique pour créer un fondu (Fade in/Fade out)
function fadeAudio(audio, volumeCible, duree, callback) {
    if (!audio) return;
    clearInterval(audio.intervalFondu); // On stoppe un potentiel fondu déjà en cours

    let volumeInitial = audio.volume;
    let diff = volumeCible - volumeInitial;
    let etapes = duree / 50; // Mise à jour toutes les 50ms
    let increment = diff / etapes;
    let compteur = 0;

    if (volumeCible > 0 && audio.paused) {
        audio.play().catch(e => console.log("Waiting for interaction", e));
    }

    audio.intervalFondu = setInterval(() => {
        compteur++;
        let nouveauVolume = volumeInitial + (increment * compteur);

        // Sécurités
        if (nouveauVolume > 1) nouveauVolume = 1;
        if (nouveauVolume < 0) nouveauVolume = 0;

        audio.volume = nouveauVolume;

        if (compteur >= etapes || (increment > 0 && nouveauVolume >= volumeCible) || (increment < 0 && nouveauVolume <= volumeCible)) {
            clearInterval(audio.intervalFondu);
            audio.intervalFondu = null;
            audio.volume = volumeCible;
            if (volumeCible === 0) {
                audio.pause();
            }
            if (callback) callback();
        }
    }, 50);
}

// Éteint un lecteur en fondu puis le libère.
// On travaille sur une copie de la référence : même si audioActuel change entre-temps
// (nouvelle session lancée pendant le fondu), c'est bien l'ANCIEN lecteur qui est coupé.
function eteindreAudio(audio, duree) {
    if (!audio) return;
    audio.enFonduSortant = true;
    fadeAudio(audio, 0, duree, () => {
        audio.pause();
        audio.src = "";
    });
}

// Tirage de la prochaine piste sans répétition avec choix du premier morceau
function obtenirProchainePisteTravail() {
    const theme = themes[indexActuel];

    // Si le paquet est vide, on le recrée
    if (playlistTravail.length === 0) {

        // 1. On crée la liste de toutes les musiques SAUF la préférée
        for (let i = 1; i <= theme.musiquesTravail; i++) {
            if (i !== theme.premiereMusique) {
                playlistTravail.push(i);
            }
        }

        // 2. Algorithme de mélange (Fisher-Yates) sur le reste
        for (let i = playlistTravail.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [playlistTravail[i], playlistTravail[j]] = [playlistTravail[j], playlistTravail[i]];
        }

        // 3. On force ta musique de départ tout au début de la liste mélangée
        if (theme.premiereMusique) {
            playlistTravail.unshift(theme.premiereMusique);
        }
    }

    // On pioche et on retire la première carte du paquet
    return playlistTravail.shift();
}

function lancerMusiqueTravail() {
    const theme = themes[indexActuel];
    if (theme.musiquesTravail === 0) return;

    let numPiste = obtenirProchainePisteTravail();

    // On prépare la piste
    audioActuel = new Audio(`assets/${theme.id}_${numPiste}.mp3`);
    audioActuel.volume = 0;

    // Fondu entrant classique (fadeAudio lance aussi la lecture)
    fadeAudio(audioActuel, volumeGlobal, 2500);

    let pisteEnCours = audioActuel; // On fige cette piste dans une variable

    // 1. SURVEILLANCE DES 3 SECONDES (Mode Écran Visible)
    pisteEnCours.addEventListener('timeupdate', () => {
        // Le fondu croisé ne se lance QUE si l'utilisateur regarde la page,
        // et seulement si cette piste est toujours celle "en cours" (pas une piste qu'on éteint).
        if (!document.hidden && pisteEnCours === audioActuel && pisteEnCours.duration && (pisteEnCours.duration - pisteEnCours.currentTime <= 3) && !pisteEnCours.enFonduSortant) {
            eteindreAudio(pisteEnCours, 3000);

            if (phaseActuelle === 'travail' && !enPause) {
                lancerMusiqueTravail(); // On crée le nouveau lecteur qui se superpose
            }
        }
    });

    // 2. FILET DE SÉCURITÉ MAC / ARRIÈRE-PLAN (Mode Écran Caché)
    pisteEnCours.addEventListener('ended', () => {
        // Si la musique arrive à la fin et qu'elle n'a pas fait son fondu (car l'onglet dormait)
        if (!pisteEnCours.enFonduSortant && pisteEnCours === audioActuel && phaseActuelle === 'travail' && !enPause) {

            // On recycle EXACTEMENT le même lecteur audio pour ne pas alerter le Mac
            let numPisteSuivante = obtenirProchainePisteTravail();
            pisteEnCours.src = `assets/${theme.id}_${numPisteSuivante}.mp3`;
            pisteEnCours.currentTime = 0;
            pisteEnCours.volume = volumeGlobal;

            pisteEnCours.play().catch(e => console.log("Playback blocked in background", e));
            // Pas besoin de refaire de fondu entrant, ça s'enchaîne comme une playlist classique !
        }
    });
}

function lancerMusiquePause() {
    const theme = themes[indexActuel];
    if (!theme.musiquePause) return;

    audioActuel = new Audio(theme.musiquePause);
    audioActuel.volume = 0;
    audioActuel.loop = true; // Le son tourne en boucle

    fadeAudio(audioActuel, volumeGlobal, 2500); // fadeAudio lance la lecture (avec gestion d'erreur)
}

// Fonction pour faire la transition propre entre Pause et Travail
function transitionPhase(nouvellePhaseCallback) {
    if (audioActuel && !audioActuel.paused) {
        eteindreAudio(audioActuel, 2000); // On baisse le volume de la phase précédente
    }
    nouvellePhaseCallback();
}

// --- 3.5 LOGIQUE DES BRUITAGES UI (INTERFACE) ---
const sonHover = new Audio('assets/hover.mp3');
const sonClick = new Audio('assets/click.mp3');

sonHover.volume = 0.1;
sonClick.volume = 0.2;

function jouerSonHover() {
    sonHover.currentTime = 0;
    sonHover.play().catch(e => {});
}

function jouerSonClick() {
    sonClick.currentTime = 0;
    sonClick.play().catch(e => {});
}

const elementsCliquables = document.querySelectorAll('button, #btn-prev, #btn-next, #current-theme-card');

elementsCliquables.forEach(element => {
    element.addEventListener('mouseenter', jouerSonHover);
    element.addEventListener('click', jouerSonClick);
});

// --- 4. LOGIQUE DU MENU ET TIMER ---

function mettreAJourCarte() {
    const theme = themes[indexActuel];
    themeTitle.textContent = theme.nom;
    themeDesc.textContent = theme.desc;
    afficherVideo(theme);
}

btnNext.addEventListener('click', () => { indexActuel = (indexActuel + 1) % themes.length; mettreAJourCarte(); });
btnPrev.addEventListener('click', () => { indexActuel = (indexActuel - 1 + themes.length) % themes.length; mettreAJourCarte(); });

function mettreAJourAffichageTemps() {
    let minutes = Math.floor(tempsRestant / 60);
    let secondes = tempsRestant % 60;
    if (minutes < 10) minutes = '0' + minutes;
    if (secondes < 10) secondes = '0' + secondes;
    affichageTemps.textContent = minutes + ":" + secondes;

    const pourcentage = (tempsRestant / tempsMaxPhase) * 100;
    progressBar.style.width = pourcentage + "%";
}

// Lance le compte à rebours d'une nouvelle phase.
// Le temps est calculé à partir de l'horloge réelle (Date.now) et non en comptant
// des "ticks" : même si le navigateur ralentit l'onglet en arrière-plan, le timer reste juste.
function nouvellePhase(nom, duree) {
    phaseActuelle = nom;
    tempsMaxPhase = duree;
    tempsRestant = duree;
    finPhase = Date.now() + duree * 1000;
}

function entrerPhaseTravail() {
    nouvellePhase('travail', TEMPS_TRAVAIL);
    affichageStatus.textContent = `Focus (${cyclesCompletes + 1}/${CYCLES_MAX})`;
    luminositeVideo(1);
    progressBar.style.backgroundColor = "#e74c3c";
    btnSkipPrep.classList.add('hidden');
    prepMessage.classList.add('hidden');

    transitionPhase(() => lancerMusiqueTravail());
}

function entrerPhasePause() {
    nouvellePhase('pause', TEMPS_PAUSE);
    affichageStatus.textContent = `Break... (${cyclesCompletes + 1}/${CYCLES_MAX})`;
    luminositeVideo(0.3);
    progressBar.style.backgroundColor = "#3498db";

    transitionPhase(() => lancerMusiquePause());
}

function terminerSession() {
    clearInterval(timerActif);
    phaseActuelle = 'terminee';
    tempsRestant = 0;
    affichageStatus.textContent = "SESSION COMPLETE!";
    affichageTemps.textContent = "00:00";
    luminositeVideo(1);
    progressBar.style.width = "0%";
    btnPause.classList.add('hidden');     // Plus rien à mettre en pause
    btnSkipPrep.classList.add('hidden');

    eteindreAudio(audioActuel, 2000);
    audioActuel = null;
}

function changerPhase() {
    if (phaseActuelle === 'preparation') {
        entrerPhaseTravail();
    } else if (phaseActuelle === 'travail') {
        entrerPhasePause();
    } else if (phaseActuelle === 'pause') {
        cyclesCompletes++;
        if (cyclesCompletes >= CYCLES_MAX) {
            terminerSession();
            return;
        }
        entrerPhaseTravail();
    }
    mettreAJourAffichageTemps();
}

function demarrerTimer() {
    clearInterval(timerActif);

    if (audioActuel) {
        eteindreAudio(audioActuel, 300);
        audioActuel = null;
    }

    nouvellePhase('preparation', TEMPS_PREPARATION);
    cyclesCompletes = 0;
    enPause = false;
    playlistTravail = []; // On réinitialise la playlist pour être sûr de tirer la "premiereMusique"

    btnPause.textContent = "⏸ Pause";
    btnPause.classList.remove('hidden');
    jouerVideo();

    affichageStatus.textContent = "Lifting off...";
    luminositeVideo(0.6);
    progressBar.style.backgroundColor = "#ffd700";
    btnSkipPrep.classList.remove('hidden');
    prepMessage.classList.remove('hidden');

    lancerMusiquePause();
    mettreAJourAffichageTemps();

    // On vérifie 4 fois par seconde, mais l'affichage ne change que quand la seconde change
    timerActif = setInterval(() => {
        if (enPause) return;
        const restant = Math.max(0, Math.ceil((finPhase - Date.now()) / 1000));
        if (restant !== tempsRestant) {
            tempsRestant = restant;
            mettreAJourAffichageTemps();
        }
        if (restant <= 0) changerPhase();
    }, 250);
}

// --- 5. INTERACTIONS ---
themeCard.addEventListener('click', () => {
    const themeChoisi = themes[indexActuel];
    menuScreen.classList.add('hidden');
    timerScreen.classList.remove('hidden');
    timerThemeName.textContent = themeChoisi.nom;
    demarrerTimer();
});

btnSkipPrep.addEventListener('click', () => {
    if (phaseActuelle !== 'preparation') return;
    if (enPause) {                 // Si on skip pendant une pause, on reprend proprement
        enPause = false;
        btnPause.textContent = "⏸ Pause";
        jouerVideo();
    }
    changerPhase();
});

btnPause.addEventListener('click', () => {
    if (phaseActuelle === 'terminee' || phaseActuelle === 'menu') return;

    if (enPause) {
        enPause = false;
        finPhase = Date.now() + tempsRestant * 1000; // On repart du temps restant
        btnPause.textContent = "⏸ Pause";
        jouerVideo();
        if (audioActuel) fadeAudio(audioActuel, volumeGlobal, 1000); // Utilise la variable du slider à la reprise
    } else {
        enPause = true;
        btnPause.textContent = "▶ Resume";
        pauserVideo();
        if (audioActuel) fadeAudio(audioActuel, 0, 1000); // fadeAudio met déjà en pause à 0
    }
});

btnQuitter.addEventListener('click', () => {
    clearInterval(timerActif);
    phaseActuelle = 'menu';   // Empêche les pistes en cours de relancer une musique de travail
    enPause = false;

    eteindreAudio(audioActuel, 1000);
    audioActuel = null;       // Libéré tout de suite : une nouvelle session peut démarrer sans conflit

    timerScreen.classList.add('hidden');
    menuScreen.classList.remove('hidden');
    luminositeVideo(1);
    prepMessage.classList.add('hidden');
    jouerVideo();
});

// --- GESTION DU PLEIN ÉCRAN (Version Corrigée & Synchronisée) ---

// Sur iPhone, le plein écran n'existe pas pour une page web : on cache le bouton
if (!document.fullscreenEnabled) {
    btnFullscreen.classList.add('hidden');
}

// 1. L'action de cliquer sur le bouton
btnFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.log(`Error attempting to enable fullscreen mode: ${err.message}`);
        });
    } else {
        document.exitFullscreen();
    }
});

// 2. L'écouteur magique qui synchronise l'affichage (même avec la touche Échap)
document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) {
        // On est en plein écran
        btnFullscreen.textContent = "✖ Exit Fullscreen";
    } else {
        // On n'est plus en plein écran
        btnFullscreen.textContent = "⛶ Fullscreen";
    }
});

mettreAJourCarte();

volumeSlider.addEventListener('input', (e) => {
    volumeGlobal = parseFloat(e.target.value);

    // Si une musique est en cours et n'est pas en train de s'éteindre (fondu sortant)
    if (audioActuel && !audioActuel.enFonduSortant && !enPause) {
        // Si un fondu entrant est en cours, on l'arrête : sinon il écraserait le réglage
        clearInterval(audioActuel.intervalFondu);
        audioActuel.intervalFondu = null;
        audioActuel.volume = volumeGlobal;
    }
});
document.getElementById('btn-kofi').addEventListener('mouseenter', jouerSonHover);
