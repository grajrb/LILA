// Simple test to check if Railway backend is running
fetch('https://lila-backend.up.railway.app/v2/healthcheck')
  .then(response => {
    console.log('✅ Backend Status:', response.status);
    return response.json();
  })
  .then(data => {
    console.log('✅ Backend Response:', data);
  })
  .catch(error => {
    console.log('❌ Backend Error:', error.message);
  });