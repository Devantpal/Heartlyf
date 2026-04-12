fetch("https://heartlyf-ai-api.onrender.com");


firebase.database()
  .ref("ecg_data")
  .limitToLast(50)
  .on("value", (snapshot) => {

    let signalArray = [];

    snapshot.forEach((child) => {
      const val = child.val().value;
      if(val !== undefined){
        signalArray.push(val);
      }
    });

    if(signalArray.length === 0) return;

    const signal = signalArray.join(",");

    drawECG(signal);

    analyzeSignal(signal);

});

function drawECG(signal){

const values = signal.split(",").map(Number);

if(window.ecgChartInstance){
  window.ecgChartInstance.destroy();
}

window.ecgChartInstance = new Chart(document.getElementById("ecgChart"),{

type:"line",

data:{
labels:values.map((_,i)=>i),

datasets:[{
data:values,
borderColor:"#ff0033",
borderWidth:2,
pointRadius:0
}]

},

options:{
animation:false,
responsive:true

}

});

}

function updatePredictionUI(data){

const statusElement = document.getElementById("ecgStatus");
const confidenceElement = document.getElementById("confidence");

statusElement.innerText = data.status;
confidenceElement.innerText = (data.confidence*100).toFixed(2)+"%";

}

async function analyzeSignal(signal){
drawECG(signal);
const result = await predictECG(signal);
updatePredictionUI(result);

}