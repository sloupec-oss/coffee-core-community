(function () {
  const GA_ID = 'G-N7BTQF9KCN';
  const KEY = 'ccc_cookie_consent';

  function loadGA() {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID);
  }

  function hideBanner() {
    var b = document.getElementById('ccc-cookie-banner');
    if (b) b.style.display = 'none';
  }

  function showBanner() {
    var b = document.getElementById('ccc-cookie-banner');
    if (b) b.style.display = 'flex';
  }

  function applyConsent(choice) {
    localStorage.setItem(KEY, choice);
    hideBanner();
    if (choice === 'accepted') loadGA();
  }

  window.reopenCookieConsent = function () {
    localStorage.removeItem(KEY);
    showBanner();
  };

  function injectStyles() {
    var style = document.createElement('style');
    style.textContent = [
      '#ccc-cookie-banner{',
        'display:none;position:fixed;bottom:0;left:0;right:0;z-index:9000;',
        'background:var(--sage-dark,#2E3D2E);',
        'padding:18px 24px;',
        'box-shadow:0 -4px 32px rgba(0,0,0,.18);',
        'font-family:"DM Sans",sans-serif;',
      '}',
      '#ccc-cookie-banner .cb-inner{',
        'max-width:720px;margin:0 auto;',
        'display:flex;flex-direction:column;gap:14px;',
      '}',
      '#ccc-cookie-banner .cb-text{',
        'font-size:13px;line-height:1.65;',
        'color:var(--sage-mist,#C8D5C4);margin:0;',
      '}',
      '#ccc-cookie-banner .cb-btns{',
        'display:flex;gap:10px;flex-wrap:wrap;align-items:center;',
      '}',
      '#ccc-accept{',
        'background:var(--cream,#F5F0E8);color:var(--sage-dark,#2E3D2E);',
        'border:none;border-radius:100px;padding:9px 22px;',
        'font-family:"DM Sans",sans-serif;font-size:12px;font-weight:600;',
        'letter-spacing:.06em;text-transform:uppercase;cursor:pointer;',
        'transition:opacity .2s;',
      '}',
      '#ccc-accept:hover{opacity:.85}',
      '#ccc-decline{',
        'background:transparent;color:var(--sage-mist,#C8D5C4);',
        'border:1px solid var(--sage-mist,#C8D5C4);border-radius:100px;',
        'padding:9px 22px;',
        'font-family:"DM Sans",sans-serif;font-size:12px;font-weight:500;',
        'letter-spacing:.06em;text-transform:uppercase;cursor:pointer;',
        'transition:color .2s,border-color .2s;',
      '}',
      '#ccc-decline:hover{color:var(--cream,#F5F0E8);border-color:var(--cream,#F5F0E8)}',
      '@media(min-width:640px){',
        '#ccc-cookie-banner .cb-inner{flex-direction:row;align-items:center;justify-content:space-between;}',
        '#ccc-cookie-banner .cb-btns{flex-shrink:0;}',
      '}',
    ].join('');
    document.head.appendChild(style);
  }

  function injectBanner() {
    var div = document.createElement('div');
    div.id = 'ccc-cookie-banner';
    div.setAttribute('role', 'dialog');
    div.setAttribute('aria-label', 'Cookie consent');
    div.innerHTML = [
      '<div class="cb-inner">',
        '<p class="cb-text" data-cs>',
          'Tento web používá cookies pro analytické účely (Google Analytics), abychom pochopili, jak web používáte.',
          ' Cookies nejsou nutné pro základní fungování webu.',
          ' Svou volbu můžete kdykoliv změnit přes <strong style="color:var(--cream,#F5F0E8)">Nastavení cookies</strong> v patičce.',
        '</p>',
        '<p class="cb-text" data-en style="display:none">',
          'This website uses cookies for analytics (Google Analytics) to help us understand how the site is used.',
          ' These cookies are not required for the website\'s basic functioning.',
          ' You can change your choice at any time via <strong style="color:var(--cream,#F5F0E8)">Cookie settings</strong> in the footer.',
        '</p>',
        '<div class="cb-btns">',
          '<button id="ccc-accept">',
            '<span data-cs>Přijmout</span>',
            '<span data-en style="display:none">Accept</span>',
          '</button>',
          '<button id="ccc-decline">',
            '<span data-cs>Odmítnout</span>',
            '<span data-en style="display:none">Decline</span>',
          '</button>',
        '</div>',
      '</div>',
    ].join('');
    document.body.appendChild(div);

    document.getElementById('ccc-accept').addEventListener('click', function () { applyConsent('accepted'); });
    document.getElementById('ccc-decline').addEventListener('click', function () { applyConsent('declined'); });
  }

  function init() {
    injectStyles();
    injectBanner();

    var saved = localStorage.getItem(KEY);
    if (saved === 'accepted') {
      loadGA();
    } else if (saved === 'declined') {
      // respektujeme volbu, GA se nenačte
    } else {
      showBanner();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
