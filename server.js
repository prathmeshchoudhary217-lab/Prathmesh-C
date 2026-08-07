const express = require('express');
const app = express();

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// In-Memory State & Device Configuration
let switchState = false; // false = OFF, true = ON
const DEVICE_ID = 'smart-switch-001';

// Dynamic Port Assignment (Render provides process.env.PORT)
const PORT = process.env.PORT || 3000;

// -----------------------------------------------------------------------------
// 1. Web UI Dashboard (GET /)
// -----------------------------------------------------------------------------
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Cloud Smart Switch Dashboard</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; background-color: #0f172a; color: #f8fafc; margin: 0; }
        .card { background: #1e293b; padding: 2.5rem; border-radius: 1rem; box-shadow: 0 10px 25px rgba(0,0,0,0.5); text-align: center; max-width: 380px; width: 100%; border: 1px solid #334155; }
        h1 { margin-top: 0; font-size: 1.5rem; color: #94a3b8; }
        .status-badge { font-size: 1.25rem; font-weight: bold; margin: 1.5rem 0; padding: 0.75rem; border-radius: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em; }
        .on { background-color: #166534; color: #4ade80; border: 1px solid #22c55e; }
        .off { background-color: #991b1b; color: #fca5a5; border: 1px solid #ef4444; }
        button { font-size: 1.1rem; font-weight: 600; padding: 0.8rem 2rem; border: none; border-radius: 0.5rem; cursor: pointer; transition: all 0.2s ease; width: 100%; }
        .btn-toggle { background-color: #3b82f6; color: white; }
        .btn-toggle:hover { background-color: #2563eb; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Smart Switch</h1>
        <div id="status" class="status-badge ${switchState ? 'on' : 'off'}">
          STATE: ${switchState ? 'ON' : 'OFF'}
        </div>
        <button class="btn-toggle" onclick="toggleSwitch()">Toggle Power</button>
      </div>

      <script>
        async function toggleSwitch() {
          const res = await fetch('/toggle', { method: 'POST' });
          const data = await res.json();
          const statusDiv = document.getElementById('status');
          if (data.on) {
            statusDiv.textContent = 'STATE: ON';
            statusDiv.className = 'status-badge on';
          } else {
            statusDiv.textContent = 'STATE: OFF';
            statusDiv.className = 'status-badge off';
          }
        }
      </script>
    </body>
    </html>
  `);
});

// -----------------------------------------------------------------------------
// 2. Status Polling (GET /status)
// -----------------------------------------------------------------------------
app.get('/status', (req, res) => {
  res.json({ on: switchState, deviceId: DEVICE_ID });
});

// -----------------------------------------------------------------------------
// 3. Dashboard Toggle (POST /toggle)
// -----------------------------------------------------------------------------
app.post('/toggle', (req, res) => {
  switchState = !switchState;
  res.json({ success: true, on: switchState });
});

// -----------------------------------------------------------------------------
// 4. Hardware Update (POST /update)
// -----------------------------------------------------------------------------
app.post('/update', (req, res) => {
  if (typeof req.body.on === 'boolean') {
    switchState = req.body.on;
    return res.json({ success: true, on: switchState });
  }
  res.status(400).json({ error: 'Invalid payload. Expected JSON: { "on": boolean }' });
});

// -----------------------------------------------------------------------------
// 5. OAuth Authorization (GET & POST /oauth/authorize)
// -----------------------------------------------------------------------------
app.get('/oauth/authorize', (req, res) => {
  const redirectUri = req.query.redirect_uri;
  const state = req.query.state;
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Link Google Home</title>
      <style>
        body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #121212; color: #fff; margin: 0; }
        .card { background: #1e1e1e; padding: 2rem; border-radius: 8px; text-align: center; }
        button { background: #4285f4; color: white; border: none; padding: 10px 20px; font-size: 16px; border-radius: 4px; cursor: pointer; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>Link Account to Google Home</h2>
        <form method="POST" action="/oauth/authorize">
          <input type="hidden" name="redirect_uri" value="${redirectUri}">
          <input type="hidden" name="state" value="${state}">
          <button type="submit">Authorize Connection</button>
        </form>
      </div>
    </body>
    </html>
  `);
});

app.post('/oauth/authorize', (req, res) => {
  const redirectUri = req.body.redirect_uri;
  const state = req.body.state;
  const authCode = 'mock_auth_code_12345';
  
  if (redirectUri) {
    res.redirect(`${redirectUri}?code=${authCode}&state=${state}`);
  } else {
    res.status(400).send('Missing redirect_uri');
  }
});

// -----------------------------------------------------------------------------
// 6. OAuth Token Endpoint (POST /oauth/token)
// -----------------------------------------------------------------------------
app.post('/oauth/token', (req, res) => {
  res.json({
    token_type: 'Bearer',
    access_token: 'mock_access_token_67890',
    refresh_token: 'mock_refresh_token_abcde',
    expires_in: 3600
  });
});

// -----------------------------------------------------------------------------
// 7. Google Fulfillment (POST /google-fulfillment)
// -----------------------------------------------------------------------------
app.post('/google-fulfillment', (req, res) => {
  const reqData = req.body;
  const requestId = reqData.requestId;
  const intent = reqData.inputs[0].intent;

  let responseData = {};

  if (intent === 'action.devices.SYNC') {
    responseData = {
      requestId: requestId,
      payload: {
        agentUserId: 'user-001',
        devices: [{
          id: DEVICE_ID,
          type: 'action.devices.types.SWITCH',
          traits: ['action.devices.traits.OnOff'],
          name: {
            defaultNames: ['Cloud Smart Switch'],
            name: 'Smart Switch'
          },
          willReportState: false
        }]
      }
    };
  } else if (intent === 'action.devices.QUERY') {
    responseData = {
      requestId: requestId,
      payload: {
        devices: {
          [DEVICE_ID]: {
            online: true,
            on: switchState
          }
        }
      }
    };
  } else if (intent === 'action.devices.EXECUTE') {
    const commands = reqData.inputs[0].payload.commands;
    const executionResults = [];

    commands.forEach(command => {
      command.execution.forEach(exec => {
        if (exec.command === 'action.devices.commands.OnOff') {
          switchState = exec.params.on;
          executionResults.push({
            ids: [DEVICE_ID],
            status: 'SUCCESS',
            states: {
              on: switchState,
              online: true
            }
          });
        }
      });
    });

    responseData = {
      requestId: requestId,
      payload: {
        commands: executionResults
      }
    };
  }

  res.json(responseData);
});

// Start Server
app.listen(PORT, () => {
  console.log(`Cloud Smart Switch server listening on port ${PORT}`);
});
