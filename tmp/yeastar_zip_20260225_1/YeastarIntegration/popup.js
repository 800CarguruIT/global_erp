(function () {
  var seenEvents = {};

  function eventKey(event) {
    if (event && event.call_id) {
      var receivedAt = event && event.received_at ? String(event.received_at) : "";
      return "call:" + String(event.call_id) + "|" + receivedAt;
    }
    return "evt:" + [
      event && event.from ? event.from : "",
      event && event.to ? event.to : "",
      event && event.extension ? event.extension : "",
      event && event.received_at ? event.received_at : ""
    ].join("|");
  }

  function isDuplicateEvent(event) {
    var key = eventKey(event);
    if (!key) {
      return false;
    }
    pruneSeenEvents();
    if (seenEvents[key]) {
      return true;
    }
    seenEvents[key] = Date.now();
    return false;
  }

  function pruneSeenEvents() {
    var now = Date.now();
    var ttlMs = 5 * 60 * 1000;
    Object.keys(seenEvents).forEach(function (k) {
      if ((now - seenEvents[k]) > ttlMs) {
        delete seenEvents[k];
      }
    });
  }

  function createPopupHtml(event, customerUrlBase) {
    var customer = event.customer || null;
    var title = event.record_name || (customer && customer.name ? customer.name : "New Caller - Create Lead!");
    var number = event.number || event.from || event.to || "-";
    var customerTypeRaw = event.type_label || (customer && customer.type ? String(customer.type) : "");
    var customerType = normalizeCustomerType(customerTypeRaw);
    var accountId = event.account_id || (customer && customer.id ? customer.id : "");
    var department = event.department || "";
    var leadType = event.lead_type || "";
    var stage = event.stage || "";
    var insurance = event.insurance || null;
    var customerLink = customerUrlBase + "?acc_id=" + encodeURIComponent(accountId) + "&phone=" + encodeURIComponent(number) + "&uniqueid=" + encodeURIComponent(event.call_id || "");
    var cardId = "yeastar-popup-" + Math.random().toString(36).slice(2);
    var badgeHtml = "<span class='yeastar-badge badge-unknown'>New Caller</span>";
    if (customerType === "CHSC") {
      badgeHtml = "<span class='yeastar-badge badge-chsc'>CHSC</span>";
    } else if (customerType === "Regular" || customerType === "Premium" || customerType === "Standard") {
      badgeHtml = "<span class='yeastar-badge badge-regular'>" + escapeHtml(customerType) + "</span>";
    }
    if (insurance && insurance.name) {
      badgeHtml = "<span class='yeastar-badge badge-insurance'>" + escapeHtml(insurance.name) + "</span>";
    }

    var bodyRows = "";
    if (title && department) {
      bodyRows += "<tr><td>Goto Lead</td><td><a target='_blank' href='" + customerLink + "'>" + escapeHtml(title) + "</a></td></tr>";
      bodyRows += "<tr><td>Number</td><td>" + escapeHtml(number) + "</td></tr>";
      bodyRows += "<tr><td>Lead Department</td><td>" + escapeHtml(department) + "</td></tr>";
      bodyRows += "<tr><td>Lead Type</td><td>" + escapeHtml(leadType || "-") + "</td></tr>";
      bodyRows += "<tr><td>Lead Stage</td><td>" + escapeHtml(stage || "-") + "</td></tr>";
    } else {
      bodyRows += "<tr><td>Customer Name</td><td><a target='_blank' href='" + customerLink + "'>" + escapeHtml(title) + "</a></td></tr>";
      bodyRows += "<tr><td>Number</td><td>" + escapeHtml(number) + "</td></tr>";
      bodyRows += "<tr><td>Lead Department</td><td>No Open Leads!</td></tr>";
      bodyRows += "<tr><td>Goto Leads</td><td><a class='btn btn-xs btn-info' target='_blank' href='" + customerLink + "'>Create New Lead</a></td></tr>";
    }
    if (insurance && insurance.id) {
      bodyRows += "<tr><td>Insurance</td><td><a class='btn btn-xs btn-warning' target='_blank' href='/ins_data.php?id=" + encodeURIComponent(insurance.id) + "'>Insurance Customer</a></td></tr>";
    }
    bodyRows += "<tr><td>Direction</td><td>" + escapeHtml(event.direction || "Inbound") + "</td></tr>";
    bodyRows += "<tr><td>Extension</td><td>" + escapeHtml(event.extension || "-") + "</td></tr>";
    bodyRows += "<tr><td>Customer Type</td><td>" + escapeHtml(customerType) + "</td></tr>";
    bodyRows += "<tr><td>Duration</td><td>-</td></tr>";

    return (
      "<div class='yeastar-popup-card' id='" + cardId + "' data-call-id='" + (event.call_id || "") + "'>" +
      "  <div class='yeastar-popup-head'>" +
      "    <strong><a class='yeastar-title-link' target='_blank' href='" + customerLink + "'>" + escapeHtml(title) + "</a></strong>" +
      "    <div class='yeastar-popup-head-actions'>" +
      "      " + badgeHtml +
      "      <a class='btn btn-xs btn-primary yeastar-dashboard-btn' target='_blank' href='" + customerLink + "'>Dashboard</a>" +
      "      <button class='yeastar-hide-btn' onclick='hideYeastarPopup(\"" + cardId + "\")'>Hide</button>" +
      "    </div>" +
      "  </div>" +
      "  <div class='yeastar-popup-body'>" +
      "    <table class='table table-sm table-dark yeastar-popup-table'>" +
      "      " + bodyRows +
      "    </table>" +
      "  </div>" +
      "</div>"
    );
  }

  function ensureStyle() {
    if (document.getElementById("yeastar-popup-style")) {
      return;
    }
    var css = ""
      + ".yeastar-popup-wrap{position:fixed;right:14px;bottom:14px;width:360px;max-height:60vh;overflow:auto;z-index:9999;font-family:Arial,sans-serif;}"
      + ".yeastar-popup-card{background:#fff;border:1px solid #ddd;border-left:4px solid #0d6efd;border-radius:4px;margin-top:8px;box-shadow:0 4px 14px rgba(0,0,0,.12);}"
      + ".yeastar-popup-head{display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:#f8f9fa;border-bottom:1px solid #eee;gap:8px;}"
      + ".yeastar-popup-head-actions{display:flex;align-items:center;gap:8px;}"
      + ".yeastar-popup-body{padding:10px;font-size:12px;line-height:1.6;}"
      + ".yeastar-badge{font-size:11px;padding:2px 6px;border-radius:10px;white-space:nowrap;}"
      + ".yeastar-title-link{color:#111;text-decoration:none;}"
      + ".yeastar-title-link:hover{text-decoration:underline;}"
      + ".yeastar-popup-table{margin-bottom:0;color:#fff;background:#343a40;}"
      + ".yeastar-popup-table td{padding:4px 6px;vertical-align:middle;}"
      + ".badge-unknown{background:#f0ad4e;color:#111;}"
      + ".badge-chsc{background:#28a745;color:#fff;}"
      + ".badge-regular{background:#17a2b8;color:#fff;}"
      + ".badge-insurance{background:#dc3545;color:#fff;}"
      + ".yeastar-dashboard-btn{white-space:nowrap;}"
      + ".yeastar-hide-btn{border:1px solid #cfcfcf;background:#fff;padding:2px 6px;border-radius:3px;font-size:11px;line-height:1.2;cursor:pointer;}";
    var style = document.createElement("style");
    style.id = "yeastar-popup-style";
    style.innerHTML = css;
    document.head.appendChild(style);
  }

  function ensureContainer(containerId) {
    var el = document.getElementById(containerId);
    if (!el) {
      el = document.createElement("div");
      el.id = containerId;
      el.className = "yeastar-popup-wrap";
      document.body.appendChild(el);
    }
    return el;
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeCustomerType(value) {
    var v = String(value || "").trim().toLowerCase();
    if (!v) {
      return "Unknown";
    }
    if (v === "regular") {
      return "Regular";
    }
    if (v === "premium") {
      return "Premium";
    }
    if (v === "standard") {
      return "Standard";
    }
    return value;
  }

  function hideYeastarPopup(cardId) {
    var el = document.getElementById(cardId);
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }

  function startYeastarPopup(options) {
    options = options || {};
    var extension = options.extension || "";
    var streamUrl = options.streamUrl || "/YeastarIntegration/sse.php";
    var customerUrlBase = options.customerUrlBase || "/Accounts/pages/customer.php";
    var containerId = options.containerId || "yeastar-popup-container";
    var wsUrl = options.wsUrl || "";
    var instanceKey = streamUrl + "|" + extension;

    if (!extension) {
      console.warn("Yeastar popup disabled: missing extension");
      return;
    }

    if (window.__yeastarPopupInstanceKey === instanceKey && window.__yeastarPopupRunning) {
      return;
    }
    window.__yeastarPopupInstanceKey = instanceKey;
    window.__yeastarPopupRunning = true;

    ensureStyle();
    var container = ensureContainer(containerId);

    function handlePayload(payload) {
      if (!payload || payload.type === "connected") {
        return;
      }
      if (isDuplicateEvent(payload)) {
        return;
      }
      console.log("Yeastar incoming_call", payload);
      container.insertAdjacentHTML("afterbegin", createPopupHtml(payload, customerUrlBase));
    }

    function connectSse() {
      if (window.__yeastarEventSource) {
        try {
          window.__yeastarEventSource.close();
        } catch (e) {}
      }
      var source = new EventSource(streamUrl + "?extension=" + encodeURIComponent(extension));
      window.__yeastarEventSource = source;
      source.addEventListener("incoming_call", function (evt) {
        try {
          var payload = JSON.parse(evt.data);
          handlePayload(payload);
        } catch (e) {
          console.error("Yeastar popup parse error", e);
        }
      });
      source.onerror = function () {
        source.close();
        setTimeout(connectSse, 2500);
      };
    }

    function buildWsUrl(baseUrl) {
      if (baseUrl) {
        return baseUrl + "?extension=" + encodeURIComponent(extension);
      }
      var proto = location.protocol === "https:" ? "wss://" : "ws://";
      return proto + location.hostname + ":5190/?extension=" + encodeURIComponent(extension);
    }

    function connectWsThenFallback() {
      var finalWsUrl = buildWsUrl(wsUrl);
      var ws;
      try {
        ws = new WebSocket(finalWsUrl);
      } catch (e) {
        connectSse();
        return;
      }

      window.__yeastarWebSocket = ws;
      var opened = false;

      ws.onopen = function () {
        opened = true;
        console.log("Yeastar websocket connected:", finalWsUrl);
      };

      ws.onmessage = function (evt) {
        try {
          var payload = JSON.parse(evt.data);
          handlePayload(payload);
        } catch (e) {
          console.error("Yeastar websocket parse error", e);
        }
      };

      ws.onerror = function () {};

      ws.onclose = function () {
        if (!opened) {
          connectSse();
          return;
        }
        setTimeout(connectWsThenFallback, 2500);
      };
    }

    function connect() {
      // Default to SSE unless a websocket URL is explicitly provided.
      if (!wsUrl) {
        connectSse();
        return;
      }
      connectWsThenFallback();
    }

    connect();
  }

  window.startYeastarPopup = startYeastarPopup;
  window.hideYeastarPopup = hideYeastarPopup;
})();
