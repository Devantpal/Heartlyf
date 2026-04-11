fetch("https://heartlyf-ai-api.onrender.com");

function generateDummyECG(){

let signal=[];

for(let i=0;i<720;i++){

signal.push((Math.sin(i/10)+Math.random()*0.2).toFixed(3));

}

return signal.join(",");

}

function drawECG(signal){

const values = signal.split(",").map(Number);

new Chart(document.getElementById("ecgChart"),{

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

async function analyzeSignal(){

const signal = generateDummyECG();

drawECG(signal);

const result = await predictECG(signal);

updatePredictionUI(result);

}