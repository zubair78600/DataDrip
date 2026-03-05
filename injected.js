(function () {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
        this._url = url;
        return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function () {
        this.addEventListener('load', function () {
            // Broaden the check. Look for ANY response starting with )]}', and dispatch it
            if (this.responseText && this.responseText.startsWith(")]}'")) {
                try {
                    const detail = {
                        url: this._url,
                        str: this.responseText
                    };
                    window.dispatchEvent(new CustomEvent('gmaps-data-intercepted', { detail }));
                } catch (e) {
                    console.error("Error dispatching intercept event", e);
                }
            }
        });

        return originalSend.apply(this, arguments);
    };

    // Also intercept fetch requests just in case Google Maps switched to fetch!
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        const response = await originalFetch.apply(this, args);
        const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) ? args[0].url : '';

        try {
            const clone = response.clone();
            clone.text().then(text => {
                if (text && text.startsWith(")]}'")) {
                    const detail = {
                        url: url,
                        str: text
                    };
                    window.dispatchEvent(new CustomEvent('gmaps-data-intercepted', { detail }));
                }
            }).catch(e => { });
        } catch (e) {
            console.error("Error cloning fetch response", e);
        }

        return response;
    };

    console.log("[GMaps Extractor] XHR & Fetch interceptor injected successfully!");
})();
