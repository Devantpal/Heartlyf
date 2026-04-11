const API_URL = "https://heartlyf-ai-api.onrender.com";

async function predictECG(ecgSignal){

try{

const response = await fetch(API_URL + "/predict",{

method:"POST",

headers:{
"Content-Type":"application/x-www-form-urlencoded"
},

body:"ecg_signal=" + ecgSignal

});

const data = await response.json();

return data;

}

catch(error){

console.error("API error:",error);

return {
status:"API_ERROR",
confidence:0
};

}

}