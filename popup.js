let timerInterval;

document.getElementById('add-url').addEventListener('click', () => {
  const urlInput = document.getElementById('url-input');
  const url = urlInput.value.trim();

  if (url) {
    // Validate the URL format
    const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
    const isValidUrl = urlPattern.test(url);

    if (isValidUrl) {
      chrome.storage.sync.get(['blockedUrls'], (data) => {
        const blockedUrls = data.blockedUrls || [];

        // Check if the URL already exists in the list
        if (!blockedUrls.includes(url)) {
          blockedUrls.push(url);
          chrome.storage.sync.set({ blockedUrls });
          displayUrls(blockedUrls);
        } else {
          alert("This URL is already in the list.");
        }

        urlInput.value = ''; // Clear the input field
      });
    } else {
      alert("Please enter a valid URL.");
      urlInput.value = '';
    }
  }
});

// Add event listener for Enter key press on url-input
document.getElementById('url-input').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    document.getElementById('add-url').click();
  }
});

document.getElementById('add-current-url').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentUrl = tabs[0].url;
    chrome.storage.sync.get(['blockedUrls'], (data) => {
      const blockedUrls = data.blockedUrls || [];

      // Check if the URL already exists in the list
      if (!blockedUrls.includes(currentUrl)) {
        blockedUrls.push(currentUrl);
        chrome.storage.sync.set({ blockedUrls });
        displayUrls(blockedUrls);
      } else {
        alert("This URL is already in the list.");
        document.getElementById('add-current-url').disabled = true;
      }
    });
  });
});

document.getElementById('start-timer').addEventListener('click', () => {
  const duration = parseInt(document.getElementById('duration').value, 10);
  chrome.storage.sync.get(['blockedUrls'], (data) => {
    const blockedUrls = data.blockedUrls || [];
    startBlocking(blockedUrls, duration);
  });
});

document.getElementById('duration').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    document.getElementById('start-timer').click();
  }
});

document.getElementById('stop-timer').addEventListener('click', () => {
  stopBlocking(); // Manually stop the focus session
});

function displayUrls(urls) {
  const urlList = document.getElementById('url-list');
  urlList.innerHTML = '';
  urls.forEach((url, index) => {
    const li = document.createElement('li');
    li.textContent = url;

    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'X';
    deleteButton.className = 'delete-btn';
    deleteButton.addEventListener('click', () => removeUrl(index)); // Add event listener for removing URL

    li.appendChild(deleteButton);
    urlList.appendChild(li);
  });
}

function removeUrl(index) {
  chrome.runtime.sendMessage({ action: 'getTimerStatus' }, (response) => {
    if (!response.timerEnd) { // Only allow removing if no session is active
      chrome.storage.sync.get(['blockedUrls'], (data) => {
        const blockedUrls = data.blockedUrls || [];
        blockedUrls.splice(index, 1);
        chrome.storage.sync.set({ blockedUrls });
        displayUrls(blockedUrls); // Update the list
        document.getElementById('add-current-url').disabled = false;
      });
    } else {
      alert("Cannot remove URLs while a session is active.");
    }
  });
}

function startBlocking(urls, duration) {
  chrome.runtime.sendMessage({ action: 'startBlocking', urls, duration }, (response) => {
    console.log(response.status);
    startTimerDisplay(); // Start updating the timer display
    disableInputs(true); // Disable inputs during the focus session
    toggleStopButton(true); // Show stop button
    document.getElementById('add-current-url').disabled = true;
  });
}

function stopBlocking() {
  const userConfirmed = window.confirm("Are you sure you want to stop the focus session?");
  
  if (userConfirmed) {
    // Stop the session and reset UI immediately
    chrome.runtime.sendMessage({ action: 'stopBlocking' }, () => {
      chrome.storage.sync.set({ timerEnd: null }, () => {
        clearInterval(timerInterval); // Stop the timer interval immediately
        resetTimerDisplay(); // Clear the timer display immediately
        toggleStopButton(false); // Hide the stop button immediately
        disableInputs(false); // Re-enable inputs
        disableDeleteButtons(false); // Re-enable delete buttons

        // Force UI reset to avoid flickering or incorrect state
        setTimeout(() => {
          resetUI(); 
        }, 100); 
      });
    });
  }
}

function startTimerDisplay() {
  clearInterval(timerInterval);
  updateTimerDisplay(); // Initial call
  timerInterval = setInterval(updateTimerDisplay, 1000); // Update every second
}

function updateTimerDisplay() {
  chrome.runtime.sendMessage({ action: 'getTimerStatus' }, (response) => {
    const timerDisplay = document.getElementById('timer-display');

    if (response && response.timerEnd && response.timerEnd > Date.now()) {
      const remainingTime = response.timerEnd - Date.now();

      if (remainingTime > 0) {
        const minutes = Math.floor(remainingTime / 60000);
        const seconds = Math.floor((remainingTime % 60000) / 1000);
        timerDisplay.textContent = `Time remaining: ${minutes}m ${seconds}s`;
        toggleStopButton(true); // Ensure stop button is visible if session is active
      } else {
        resetUI(); // Force reset if timer has expired
      }
    } else {
      resetUI(); // Force reset if no session is active
    }
  });
}

function resetTimerDisplay() {
  const timerDisplay = document.getElementById('timer-display');
  timerDisplay.textContent = ''; // Clear the remaining time text
  clearInterval(timerInterval); // Stop any running timer interval
}

function resetUI() {
  resetTimerDisplay();
  toggleStopButton(false); // Hide stop button
  disableInputs(false); // Re-enable inputs
  disableDeleteButtons(false); // Re-enable delete buttons
  document.getElementById('url-input').value = "";
  document.getElementById('duration').value = "";
  document.getElementById('add-current-url').disabled = false;
}

function disableInputs(disable) {
  document.getElementById('url-input').disabled = disable;
  document.getElementById('add-url').disabled = disable;
  document.getElementById('duration').disabled = disable;
  document.getElementById('start-timer').disabled = disable;
}

function disableDeleteButtons(disable) {
  const deleteButtons = document.querySelectorAll('.delete-btn');
  deleteButtons.forEach(button => {
    button.disabled = disable;
  });
}

function toggleStopButton(show) {
  document.getElementById('stop-timer').style.display = show ? 'block' : 'none';
}

// Ensure the correct UI state when the popup is loaded
chrome.storage.sync.get(['blockedUrls', 'timerEnd'], (data) => {
  displayUrls(data.blockedUrls || []);
  if (data.timerEnd && Date.now() < data.timerEnd) {
    startTimerDisplay(); // Start displaying timer if a session is active
    disableInputs(true); // Disable inputs during the focus session
    disableDeleteButtons(true); // Disable delete buttons during the session
    toggleStopButton(true); // Show stop button if session is active
  } else {
    resetUI(); // Reset UI if no session is active
  }
});
