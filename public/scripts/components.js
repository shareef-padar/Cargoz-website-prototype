/* ============================================================
   Cargoz prototype — shared navbar + footer components.
   Injected into [data-cargoz-component="navbar|footer"] holders
   on every page so any markup change here propagates everywhere.
   ============================================================ */

const CARGOZ_NAVBAR_HTML = `
<div class="inner">
  <a class="header-logo" href="index.html" aria-label="Cargoz home" style="display:flex;align-items:center;text-decoration:none;">
    <img src="https://www.figma.com/api/mcp/asset/a0b9ff07-efeb-42ce-9d6a-88386c92c665" alt="Cargoz" />
  </a>
  <nav class="header-nav">
    <a class="nav-item" href="listings.html">
      <span>See All Warehouses</span>
      <span class="nav-chevron"><svg viewBox="0 0 10 6"><polyline points="1,1 5,5 9,1" /></svg></span>
    </a>
    <a class="nav-item" href="#">
      <span>Instant Storage</span>
      <span class="nav-chevron"><svg viewBox="0 0 10 6"><polyline points="1,1 5,5 9,1" /></svg></span>
    </a>
    <a class="nav-item" href="#">
      <span>Storage Calculator</span>
      <span class="nav-chevron"><svg viewBox="0 0 10 6"><polyline points="1,1 5,5 9,1" /></svg></span>
    </a>
    <a class="nav-item" href="#"><span>How it Works</span></a>
  </nav>
  <div class="header-actions">
    <button class="btn-icon" aria-label="Saved warehouses">
      <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
    </button>
    <button class="btn-login">Login</button>
    <button class="btn-list">List Your Warehouse</button>
  </div>
</div>`;

const CARGOZ_FOOTER_HTML = `
<div class="inner">
  <div class="footer-grid">
    <div class="footer-brand">
      <div class="footer-logo">
        <div class="logo-mark"></div>
        <span>cargoz</span>
      </div>
      <p class="footer-tagline">The B2B marketplace for flexible warehouse storage across the UAE.</p>
      <div class="footer-cities">
        <a href="#" class="footer-city-chip">Dubai</a>
        <a href="#" class="footer-city-chip">Abu Dhabi</a>
        <a href="#" class="footer-city-chip">Sharjah</a>
        <a href="#" class="footer-city-chip">Ajman</a>
        <a href="#" class="footer-city-chip">Umm Al Quwain</a>
      </div>
    </div>
    <div>
      <div class="footer-col-title">About Cargoz</div>
      <a href="about.html" class="footer-link">About Us</a>
      <a href="#" class="footer-link">How It Works</a>
      <a href="#" class="footer-link">Why Cargoz</a>
      <a href="#" class="footer-link">Contact Us</a>
    </div>
    <div>
      <div class="footer-col-title">Explore</div>
      <a href="#" class="footer-link">Get Matched</a>
      <a href="listings.html" class="footer-link">See All Warehouses</a>
      <a href="#" class="footer-link">How to Choose a Warehouse</a>
      <a href="#" class="footer-link">Types of Warehouses</a>
      <a href="#" class="footer-link">Storage Calculator</a>
      <a href="#" class="footer-link">How We Verify Warehouses</a>
    </div>
    <div>
      <div class="footer-col-title">Instant Storage Solutions</div>
      <a href="#" class="footer-link">Fixed Area Storage</a>
      <a href="#" class="footer-link">Lockable Units Storage</a>
    </div>
    <div>
      <div class="footer-col-title">Locations</div>
      <a href="#" class="footer-link">Dubai</a>
      <a href="#" class="footer-link">Abu Dhabi</a>
      <a href="#" class="footer-link">Sharjah</a>
      <a href="#" class="footer-link">Ajman</a>
      <a href="#" class="footer-link">Umm Al Quwain</a>
    </div>
    <div>
      <div class="footer-col-title">Resources</div>
      <a href="#" class="footer-link">FAQs</a>
      <a href="#" class="footer-link">Blog</a>
      <a href="#" class="footer-link">Glossary</a>
    </div>
  </div>
  <hr class="footer-divider" />
  <div class="footer-browse">
    <div class="footer-browse-title">Browse warehouses by location</div>
    <div class="footer-browse-grid">
      <select class="footer-select" aria-label="Browse Dubai warehouses">
        <option>Dubai</option><option>Al Quoz</option><option>Jebel Ali</option><option>Dubai Investment Park</option><option>Dubai South</option>
      </select>
      <select class="footer-select" aria-label="Browse Abu Dhabi warehouses">
        <option>Abu Dhabi</option><option>Mussafah</option><option>ICAD</option><option>KIZAD</option>
      </select>
      <select class="footer-select" aria-label="Browse Sharjah warehouses">
        <option>Sharjah</option><option>Industrial Area</option><option>Hamriyah Free Zone</option><option>SAIF Zone</option>
      </select>
      <select class="footer-select" aria-label="Browse Ajman warehouses">
        <option>Ajman</option><option>Ajman Industrial Area</option><option>Ajman Free Zone</option>
      </select>
      <select class="footer-select" aria-label="Browse Umm Al Quwain warehouses">
        <option>Umm Al Quwain</option><option>UAQ Free Trade Zone</option>
      </select>
    </div>
  </div>
  <hr class="footer-divider" />
  <div class="footer-bottom">
    <span>© 2026 Cargoz. All rights reserved.</span>
    <div class="footer-legal">
      <a href="#">Terms of Service</a>
      <a href="#">Privacy Policy</a>
      <a href="#">Sitemap</a>
    </div>
  </div>
</div>`;

(function injectCargozComponents() {
  const nav = document.querySelector('[data-cargoz-component="navbar"]');
  if (nav && !nav.children.length) nav.innerHTML = CARGOZ_NAVBAR_HTML;
  const foot = document.querySelector('[data-cargoz-component="footer"]');
  if (foot && !foot.children.length) foot.innerHTML = CARGOZ_FOOTER_HTML;
})();
