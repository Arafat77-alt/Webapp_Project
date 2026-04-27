// Change this to your actual Render URL after deployment
const BASE_URL = "https://medisafe-api.onrender.com"; 
console.log("JS LOADED");
const medicines = [
  "warfarin", "aspirin", "metformin", "cimetidine",
  "ibuprofen", "lisinopril", "paracetamol",
  "atorvastatin", "clarithromycin", "amoxicillin",
  "digoxin", "verapamil", "simvastatin",
  "insulin", "levothyroxine", "losartan",
  "fluoxetine", "tramadol", "clopidogrel", "omeprazole",
  "diazepam"
];

window.onload = function() {
  const list = document.getElementById("medicineList");
  medicines.forEach(med => {
    const option = document.createElement("option");
    option.value = med;
    list.appendChild(option);
  });
};

async function searchDrug() {
  const name = document.getElementById("searchDrug").value.toLowerCase().trim();
  const box = document.getElementById("drugInfoBox");
  const info = document.getElementById("drugInfo");

  box.className = "result-box";

  // FIXED: Changed endpoint from /scan to /drug/${name}
  const res = await fetch(`${BASE_URL}/drug/${name}`);
  const data = await res.json();

  if (data.error) {
    info.innerText = "Drug not found";
    box.classList.add("minor");
  } else {
    info.innerText =
      "Name: " + data.name +
      "\nUse: " + data.use +
      "\nClass: " + data.class +
      "\nNotes: " + data.notes;

    box.classList.add("safe");
  }
}

async function checkInteraction() {
  const drug1 = document.getElementById("drug1").value.toLowerCase().trim();
  const drug2 = document.getElementById("drug2").value.toLowerCase().trim();

  const resultText = document.getElementById("result");
  const explanationText = document.getElementById("explanation");
  const resultBox = document.getElementById("resultBox");

  resultBox.className = "result-box";

  const res = await fetch(`${BASE_URL}/check`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ drug1, drug2 })
  });

  const data = await res.json();

  resultText.innerText = "Risk Level: " + data.risk;
  explanationText.innerText = data.explanation;

  if (data.risk === "MAJOR") resultBox.classList.add("major");
  else if (data.risk === "MODERATE") resultBox.classList.add("moderate");
  else if (data.risk === "MINOR") resultBox.classList.add("minor");
  else resultBox.classList.add("safe");
}

async function uploadImage(event) {
  // 1. Reset UI
  document.getElementById("result").innerText = "";
  document.getElementById("explanation").innerHTML = "";
  const file = event.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("image", file);

  // 2. Setup Preview
  const preview = document.getElementById("imagePreview");
  preview.src = URL.createObjectURL(file);
  preview.style.display = "block";
  document.getElementById("removeBtn").style.display = "inline-block";

  const resultText = document.getElementById("result");
  const explanationText = document.getElementById("explanation");
  const resultBox = document.getElementById("resultBox");
  const loader = document.getElementById("loader");
  const status = document.getElementById("ocrStatus");

  resultText.innerText = "Scanning prescription...";
  status.innerText = "Processing image using AI OCR...";
  loader.style.display = "block";

  try {
    const res = await fetch(`${BASE_URL}/scan`, {
      method: "POST",
      body: formData
    });

    if (!res.ok) {
      throw new Error(`Server returned ${res.status}`);
    }

    // ONLY CALL THIS ONCE
    const data = await res.json(); 
    
    loader.style.display = "none";
    status.innerText = "";

    if (data.error) {
      resultText.innerText = "OCR failed";
      resultBox.className = "result-box minor";
      return;
    }

    if (data.detected.length === 0) {
      resultText.innerText = "No known drugs detected";
      resultBox.className = "result-box minor";
      return;
    }

    // Success UI Logic
    resultText.innerText = "Detected: " + data.detected.join(", ");

    if (data.interactions.length > 0) {
      let htmlOutput = "<b>Total Interactions Found: " + data.interactions.length + "</b><br>";
      let highest = "safe";

      data.interactions.forEach(i => {
        htmlOutput += `
          <div class="interaction-item">
            ${i.pair}
            <span class="badge ${i.risk.toLowerCase()}">${i.risk}</span>
            <div>${i.explanation}</div>
          </div>`;
        
        const risk = i.risk.toLowerCase();
        if (risk === "major") highest = "major";
        else if (risk === "moderate" && highest !== "major") highest = "moderate";
        else if (risk === "minor" && highest === "safe") highest = "minor";
      });

      explanationText.innerHTML = htmlOutput;
      resultBox.className = "result-box " + highest;
    } else {
      explanationText.innerHTML = "No significant interactions found.";
      resultBox.className = "result-box safe";
    }

  } catch (error) {
    console.error("Fetch Error:", error);
    loader.style.display = "none";
    status.innerText = "Error connecting to server.";
    alert("Server error. Check if backend is awake.");
  }
}

function showSuggestions() {
  const input = document.getElementById("searchDrug").value.toLowerCase();
  const box = document.getElementById("suggestionsBox");

  box.innerHTML = "";
  if (input.length === 0) return;

  const filtered = medicines.filter(med => med.includes(input));

  filtered.forEach(med => {
    const div = document.createElement("div");
    div.innerText = med;
    div.onclick = () => {
      document.getElementById("searchDrug").value = med;
      box.innerHTML = "";
    };
    box.appendChild(div);
  });

  
}
function removeImage() {
  const preview = document.getElementById("imagePreview");
  const input = document.getElementById("imageInput");
  const btn = document.getElementById("removeBtn");
  btn.style.display = "inline-block";

  const status = document.getElementById("ocrStatus");
  const loader = document.getElementById("loader");

  const result = document.getElementById("result");
  const explanation = document.getElementById("explanation");
  const resultBox = document.getElementById("resultBox");

  preview.src = "";
  preview.style.display = "none";

  input.value = "";
  btn.style.display = "none";

  status.innerText = "";
  loader.style.display = "none";

  result.innerText = "";
  explanation.innerHTML = "";
  resultBox.className = "result-box";
}