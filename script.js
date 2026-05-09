// --- 1. LES DONNÉES ---
const themes = [
    { 
        id: 'zelda', 
        nom: 'ZELDA', 
        desc: 'Hyrulian Serenity', 
        video: 'assets/zelda.mp4',
        musiquesTravail: 20, 
        musiquePause: 'assets/pause_zelda.mp3',
        premiereMusique: 3 
    },
    { 
        id: 'mario', 
        nom: 'MARIO', 
        desc: 'Mushroom Kingdom', 
        video: 'assets/mario.mp4',
        musiquesTravail: 20, 
        musiquePause: 'assets/pause_mario.mp3',
        premiereMusique: 3 
    },
    { 
        id: 'eldenring', 
        nom: 'ELDEN RING', 
        desc: 'Rest in the Lands Between', 
        video: 'assets/eldenring.mp4',
        musiquesTravail: 20, 
        musiquePause: 'assets/pause_eldenring.mp3',
        premiereMusique: 3 
    },
    { 
        id: 'pokemon', 
        nom: 'POKÉMON', 
        desc: 'Pokémon Center', 
        video: 'assets/pokemon.mp4',
        musiquesTravail: 20, 
        musiquePause: 'assets/pause_pokemon.mp3',
        premiereMusique: 2 
    },
    { 
        id: 'minecraft', 
        nom: 'MINECRAFT', 
        desc: 'Creativity & Peace', 
        video: 'assets/minecraft.mp4',
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
let phaseActuelle = 'preparation'; 
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

const bgVideo = document.getElementById('bg-video');
const videoSource = document.getElementById('video-source');
const affichageTemps = document.getElementById('temps');
const affichageStatus = document.getElementById('status');
const progressBar = document.getElementById('progress-bar');
const prepMessage = document.getElementById('prep-message');

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
            audio.volume = volumeCible;
            if (volumeCible === 0) {
                audio.pause();
            }
            if (callback) callback();
        }
    }, 50);
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
    audioActuel.play().catch(e => console.log("Waiting for interaction", e));
    
    // Fondu entrant classique
    fadeAudio(audioActuel, volumeGlobal, 2500);

    let pisteEnCours = audioActuel; // On fige cette piste dans une variable

    // 1. SURVEILLANCE DES 3 SECONDES (Mode Écran Visible)
    pisteEnCours.addEventListener('timeupdate', () => {
        // L'astuce est là : on ajoute "!document.hidden"
        // Le fondu croisé ne se lance QUE si l'utilisateur regarde la page !
        if (!document.hidden && pisteEnCours.duration && (pisteEnCours.duration - pisteEnCours.currentTime <= 3) && !pisteEnCours.enFonduSortant) {
            pisteEnCours.enFonduSortant = true;
            
            fadeAudio(pisteEnCours, 0, 3000, () => {
                pisteEnCours.pause();
                pisteEnCours.src = ""; 
            });
            
            if (phaseActuelle === 'travail' && !enPause) {
                lancerMusiqueTravail(); // On crée le nouveau lecteur qui se superpose
            }
        }
    });

    // 2. FILET DE SÉCURITÉ MAC / ARRIÈRE-PLAN (Mode Écran Caché)
    pisteEnCours.addEventListener('ended', () => {
        // Si la musique arrive à la fin et qu'elle n'a pas fait son fondu (car l'onglet dormait)
        if (!pisteEnCours.enFonduSortant && phaseActuelle === 'travail' && !enPause) {
            
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
    audioActuel.play();
    
    fadeAudio(audioActuel, volumeGlobal, 2500); 
}

// Fonction pour faire la transition propre entre Pause et Travail
function transitionPhase(nouvellePhaseCallback) {
    if (audioActuel && !audioActuel.paused) {
        let ancienAudio = audioActuel;
        ancienAudio.enFonduSortant = true;
        // On baisse le volume de la phase précédente
        fadeAudio(ancienAudio, 0, 2000, () => {
            ancienAudio.pause();
            ancienAudio.src = "";
        });
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
    videoSource.src = theme.video;
    bgVideo.load();
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

function changerPhase() {
    if (phaseActuelle === 'preparation') {
        phaseActuelle = 'travail';
        tempsMaxPhase = TEMPS_TRAVAIL;
        tempsRestant = TEMPS_TRAVAIL;
        affichageStatus.textContent = `Focus (${cyclesCompletes + 1}/${CYCLES_MAX})`;
        bgVideo.style.filter = "brightness(1)";
        progressBar.style.backgroundColor = "#e74c3c"; 
        btnSkipPrep.classList.add('hidden');
        prepMessage.classList.add('hidden'); 
        
        transitionPhase(() => lancerMusiqueTravail());
        
    } else if (phaseActuelle === 'travail') {
        phaseActuelle = 'pause';
        tempsMaxPhase = TEMPS_PAUSE;
        tempsRestant = TEMPS_PAUSE;
        affichageStatus.textContent = `Break... (${cyclesCompletes + 1}/${CYCLES_MAX})`;
        bgVideo.style.filter = "brightness(0.3)";
        progressBar.style.backgroundColor = "#3498db"; 
        
        transitionPhase(() => lancerMusiquePause());
        
    } else {
        cyclesCompletes++;
        if (cyclesCompletes >= CYCLES_MAX) {
            clearInterval(timerActif);
            affichageStatus.textContent = "SESSION COMPLETE!";
            affichageTemps.textContent = "00:00";
            bgVideo.style.filter = "brightness(1)";
            progressBar.style.width = "0%";
            
            if (audioActuel) fadeAudio(audioActuel, 0, 2000, () => audioActuel.pause());
            return; 
        }
        phaseActuelle = 'travail';
        tempsMaxPhase = TEMPS_TRAVAIL;
        tempsRestant = TEMPS_TRAVAIL;
        affichageStatus.textContent = `Focus (${cyclesCompletes + 1}/${CYCLES_MAX})`;
        bgVideo.style.filter = "brightness(1)";
        progressBar.style.backgroundColor = "#e74c3c"; 
        
        transitionPhase(() => lancerMusiqueTravail());
    }
    mettreAJourAffichageTemps();
}

function demarrerTimer() {
    clearInterval(timerActif);
    
    if (audioActuel) {
        audioActuel.pause();
        audioActuel = null;
    }
    
    phaseActuelle = 'preparation';
    tempsMaxPhase = TEMPS_PREPARATION;
    tempsRestant = TEMPS_PREPARATION;
    cyclesCompletes = 0;
    enPause = false; 
    playlistTravail = []; // On réinitialise la playlist pour être sûr de tirer la "premiereMusique"
    
    btnPause.textContent = "⏸ Pause"; 
    bgVideo.play(); 
    
    affichageStatus.textContent = "Lifting off...";
    bgVideo.style.filter = "brightness(0.6)";
    progressBar.style.backgroundColor = "#ffd700"; 
    btnSkipPrep.classList.remove('hidden');
    prepMessage.classList.remove('hidden'); 
    
    lancerMusiquePause(); 
    mettreAJourAffichageTemps();
    
    timerActif = setInterval(() => {
        if (!enPause) {
            tempsRestant--;
            mettreAJourAffichageTemps();
            if (tempsRestant <= 0) changerPhase();
        }
    }, 1000);
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
    if (phaseActuelle === 'preparation') changerPhase();
});

btnPause.addEventListener('click', () => {
    if (enPause) {
        enPause = false;
        btnPause.textContent = "⏸ Pause";
        bgVideo.play(); 
        if (audioActuel) {
            let volCible = volumeGlobal; // Utilise la variable du slider à la reprise
            fadeAudio(audioActuel, volCible, 1000); 
        }
    } else {
        enPause = true;
        btnPause.textContent = "▶ Resume";
        bgVideo.pause(); 
        if (audioActuel) {
            fadeAudio(audioActuel, 0, 1000, () => audioActuel.pause()); 
        }
    }
});

btnQuitter.addEventListener('click', () => {
    clearInterval(timerActif);
    
    if (audioActuel) {
        fadeAudio(audioActuel, 0, 1000, () => {
            audioActuel.pause();
            audioActuel.src = "";
            audioActuel = null;
        });
    }
    
    timerScreen.classList.add('hidden');
    menuScreen.classList.remove('hidden');
    bgVideo.style.filter = "brightness(1)"; 
    prepMessage.classList.add('hidden'); 
    bgVideo.play(); 
});

btnFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.log(`Error attempting to enable fullscreen mode: ${err.message}`);
        });
        btnFullscreen.textContent = "✖ Exit Fullscreen"; 
    } else {
        document.exitFullscreen();
        btnFullscreen.textContent = "⛶ Fullscreen"; 
    }
});

mettreAJourCarte();

volumeSlider.addEventListener('input', (e) => {
    volumeGlobal = parseFloat(e.target.value);
    
    // Si une musique est en cours et n'est pas en train de s'éteindre (fondu sortant)
    if (audioActuel && !audioActuel.enFonduSortant && !enPause) {
        audioActuel.volume = volumeGlobal;
    }
});
document.getElementById('btn-kofi').addEventListener('mouseenter', jouerSonHover);