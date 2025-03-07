let video = document.getElementById('video');
let canvas = document.getElementById('canvas');
let ctx = canvas.getContext('2d');
let model;
let isDetecting = false;
let lastSpokenObject = ""; // Track last announced object
let alertSound = new Audio('nuclear-alarm-14008.mp3'); // Add an alert sound file

// Load AI Model
async function loadModel() {
    model = await cocoSsd.load();
    console.log("COCO-SSD Model Loaded!");
}

// Secure Camera Access: Now requires user action to request permissions
async function setupCamera() {
    document.getElementById('startBtn').addEventListener('click', async () => {
        try {
            let stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' } // Rear camera
            });
            video.srcObject = stream;
        } catch (err) {
            console.error("Error accessing camera: ", err);
            alert("Camera access denied or not available.");
        }
    });
}

// Estimate Distance Function
function estimateDistance(bboxWidth) {
    let referenceWidth = 200; // Adjust based on calibration
    let knownDistance = 2; // 2 meters for reference width

    let estimatedDistance = (referenceWidth / bboxWidth) * knownDistance;
    return estimatedDistance.toFixed(2);
}

// Object Detection
async function detectObjects() {
    if (!isDetecting) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    let predictions = await model.detect(video);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (predictions.length === 0) {
        lastSpokenObject = "";
        return;
    }

    let detectedObject = predictions[0].class;
    let [x, y, width, height] = predictions[0].bbox;
    let distance = estimateDistance(width);

    // Prevent XSS: Use textContent instead of innerHTML
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    ctx.fillStyle = 'red';
    ctx.fillText(`${detectedObject} (${distance}m)`, x, y - 5);

    let position = x + width / 2;
    let screenCenter = canvas.width / 2;
    let direction = position < screenCenter ? "on your left" : "on your right";

    if (detectedObject !== lastSpokenObject) {
        window.speechSynthesis.cancel();
        speak(`${detectedObject} is ${direction} and about ${distance} meters away`);
        lastSpokenObject = detectedObject;
    }

    // Vibration Alert for Close Objects (<1m)
    if (distance < 1) {
        if (navigator.vibrate) {
            navigator.vibrate([300, 100, 300]);
        }
    }

    // Sound Alert for Very Close Objects (<0.5m)
    if (distance < 0.5) {
        alertSound.play();
    }

    requestAnimationFrame(detectObjects);
}

// Secure Speech Recognition: Requires user button click to activate
function startVoiceRecognition() {
    let recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.continuous = true;
    recognition.lang = "en-US";

    let isListening = false;
    document.getElementById('voiceCmdBtn').addEventListener('click', () => {
        isListening = !isListening;
        if (isListening) {
            recognition.start();
        } else {
            recognition.stop();
        }
    });

    recognition.onresult = function (event) {
        let command = event.results[event.results.length - 1][0].transcript.toLowerCase();
        console.log("Voice Command: ", command);

        if (command.includes("start")) {
            isDetecting = true;
            detectObjects();
            speak("Starting object detection");
        } else if (command.includes("stop")) {
            isDetecting = false;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            window.speechSynthesis.cancel();
            speak("Stopping object detection");
        }
    };
}

// Speak Object, Distance, and Direction
function speak(text) {
    let speech = new SpeechSynthesisUtterance(text);
    speech.rate = 1;
    speech.pitch = 1;
    window.speechSynthesis.speak(speech);
}

// Start Detection
document.getElementById('startBtn').addEventListener('click', () => {
    isDetecting = true;
    detectObjects();
});

// Stop Detection
document.getElementById('stopBtn').addEventListener('click', () => {
    isDetecting = false;
    lastSpokenObject = "";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    window.speechSynthesis.cancel();
});

// Initialize App with Secure Implementations
setupCamera();
loadModel();
startVoiceRecognition();
