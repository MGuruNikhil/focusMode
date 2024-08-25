let timerInterval;

document.getElementById('add-url').addEventListener('click', () => {
  const urlInput = document.getElementById('url-input');
  const url = urlInput.value.trim();
  if (url) {
    chrome.storage.sync.get(['blockedUrls'], (data) => {
      const blockedUrls = data.blockedUrls || [];
      blockedUrls.push(url);
      chrome.storage.sync.set({ blockedUrls });
      displayUrls(blockedUrls);
      urlInput.value = '';
    });
  }
});

document.getElementById('start-timer').addEventListener('click', () => {
  const duration = parseInt(document.getElementById('duration').value, 10);
  chrome.storage.sync.get(['blockedUrls'], (data) => {
    const blockedUrls = data.blockedUrls || [];
    startBlocking(blockedUrls, duration);
  });
});

function displayUrls(urls) {
  const urlList = document.getElementById('url-list');
  urlList.innerHTML = '';
  urls.forEach(url => {
    const li = document.createElement('li');
    li.textContent = url;
    urlList.appendChild(li);
  });
}

function startBlocking(urls, duration) {
  chrome.runtime.sendMessage({ action: 'startBlocking', urls, duration }, (response) => {
    console.log(response.status);
    startTimerDisplay(); // Start updating the timer display
    disableInputs(true); // Disable inputs during the focus session
  });
}

function startTimerDisplay() {
  clearInterval(timerInterval);
  updateTimerDisplay(); // Initial call
  timerInterval = setInterval(updateTimerDisplay, 1000); // Update every second
}

function updateTimerDisplay() {
  chrome.runtime.sendMessage({ action: 'getTimerStatus' }, (response) => {
    const timerDisplay = document.getElementById('timer-display');

    if (response && response.timerEnd) {
      const remainingTime = response.timerEnd - Date.now();

      if (remainingTime > 0) {
        const minutes = Math.floor(remainingTime / 60000);
        const seconds = Math.floor((remainingTime % 60000) / 1000);
        timerDisplay.textContent = `Time remaining: ${minutes}m ${seconds}s`;
      } else {
        timerDisplay.textContent = 'Focus session ended!';
        clearInterval(timerInterval);
        disableInputs(false); // Re-enable inputs when the session ends
      }
    } else {
      timerDisplay.textContent = '';
      clearInterval(timerInterval);
      disableInputs(false); // Re-enable inputs if no session is active
    }
  });
}

function disableInputs(disable) {
  document.getElementById('url-input').disabled = disable;
  document.getElementById('add-url').disabled = disable;
  document.getElementById('duration').disabled = disable;
  document.getElementById('start-timer').disabled = disable;
}

chrome.storage.sync.get(['blockedUrls'], (data) => {
  displayUrls(data.blockedUrls || []);
  startTimerDisplay(); // Start displaying timer if a session is active
});
