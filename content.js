// Global counter to persist across function calls
let globalCounter = 1;
let processedResults = new Set();
let observerRef = null;
let debounceTimer = null;
let baseIndex = 0;
let isProcessing = false;

// Detect if current page is a Google web search results page
function isGoogleSearchPage() {
  try {
    const host = window.location.hostname;
    const path = window.location.pathname;
    const isGoogleHost = /(^|\.)google\./i.test(host);
    const looksLikeSearchPath = path.startsWith('/search') || path === '/';
    const hasSearchContainers = !!(document.querySelector('#search') || document.querySelector('#rso'));
    const hasQuery = new URL(window.location.href).searchParams.has('q');
    const result = isGoogleHost && (looksLikeSearchPath || hasSearchContainers) && hasQuery;
    return result;
  } catch (e) {
    return false;
  }
}


function clearExistingCounters() {  
  const existingCounters = document.querySelectorAll('.search-counter');
  existingCounters.forEach(counter => counter.remove());
  processedResults.clear();
  globalCounter = baseIndex + 1;
}

function preserveExistingCounters() {
  // Don't clear existing counters, just update the global counter to continue from where we left off
  const existingCounters = document.querySelectorAll('.search-counter');
  let maxCounter = baseIndex;
  
  // Rebuild processedResults Set from existing counters
  processedResults.clear();
  const existingAnchors = document.querySelectorAll('.search-counter');
  existingAnchors.forEach(counter => {
    const container = counter.closest('.yuRUbf, .g, .MjjYud') || counter.parentElement;
    if (container) {
      const anchor = container.querySelector('a[href]');
      if (anchor && anchor.href) {
        processedResults.add(anchor.href);
      }
    }
  });
  
  existingCounters.forEach(counter => {
    const counterText = counter.textContent.trim();
    const counterNum = parseInt(counterText.replace(/[^\d]/g, ''), 10);
    if (!isNaN(counterNum) && counterNum > maxCounter) {
      maxCounter = counterNum;
    }
  });
  
  globalCounter = maxCounter + 1;
}

// Collect anchors that correspond to organic result titles
function getOrganicAnchors() {
  const scope = document.querySelector('#search') || document;
  const rso = scope.querySelector('#rso') || scope;
  
  // Check if we're in mobile view
  const isMobileView = window.innerWidth <= 768 || 
                      document.body.classList.contains('mobile') ||
                      document.querySelector('.mnr-c') ||
                      document.querySelector('.xpd') ||
                      navigator.userAgent.includes('Mobile') ||
                      document.querySelector('[data-ved*="mobile"]');
  
  console.log(`[Counter] Mobile view detected: ${isMobileView}`);
  
  let anchors = [];
  
  if (isMobileView) {
    // Mobile-specific selectors first
    anchors = Array.from(
      scope.querySelectorAll(
        '.mnr-c a[href]:not([href*="google.com"]), ' +
        '.xpd a[href]:not([href*="google.com"]), ' +
        '.MjjYud a[href]:not([href*="google.com"]), ' +
        '.g a[href]:not([href*="google.com"]), ' +
        '#search .yuRUbf > a, ' +
        '#rso .yuRUbf > a'
      )
    );
    
    console.log(`[Counter] Mobile anchors found: ${anchors.length}`);
  } else {
    // Desktop selectors
    anchors = Array.from(
      rso.querySelectorAll('.tF2Cxc .yuRUbf > a, .g:not(.g-blk) .yuRUbf > a, .MjjYud .yuRUbf > a')
    );
  }
  
  // Fallback for different layouts
  if (anchors.length === 0) {
    anchors = Array.from(rso.querySelectorAll('.yuRUbf > a'));
  }
  
  // Additional mobile fallbacks
  if (anchors.length === 0 && isMobileView) {
    anchors = Array.from(scope.querySelectorAll('#search .MjjYud .yuRUbf > a, #search .g:not(.g-blk) .yuRUbf > a, #search .tF2Cxc .yuRUbf > a'));
  }
  
  // Generic mobile: any anchor with h3 in search results
  if (anchors.length === 0) {
    const h3s = Array.from(scope.querySelectorAll('#search h3, #rso h3'));
    const derived = [];
    for (const h3 of h3s) {
      if (!h3.isConnected || h3.offsetParent === null) continue;
      if (
        h3.closest('#topstuff, .kp-blk, .xpdopen, [data-text-ad], [data-overlay-ad], [class*="commercial-unit-"]')
      ) continue;
      let a = h3.closest('a') || h3.parentElement?.closest?.('a') || h3.querySelector('a');
      if (a && a.href && !a.href.includes('google.com')) derived.push(a);
    }
    anchors = derived;
  }
  
  // Last resort: any anchor that directly contains an h3 under #search
  if (anchors.length === 0) {
    anchors = Array.from(scope.querySelectorAll('#search a h3, #rso a h3')).map(h3 => h3.closest('a')).filter(Boolean);
  }

  // Filter and dedupe by href
  const seen = new Set();
  const filtered = anchors.filter((a) => {
    if (!a.isConnected || a.offsetParent === null) return false;
    
    // Exclude ads and special modules (but allow mobile containers)
    if (
      a.closest('#topstuff') ||
      a.closest('.kp-blk') ||
      a.closest('.xpdopen') ||
      a.closest('[data-text-ad]') ||
      a.closest('[data-overlay-ad]') ||
      a.closest('[class*="commercial-unit-"]') ||
      a.closest('[data-section-id*="local"]') ||
      a.closest('.local-results-container') ||
      a.closest('.local-result')
    ) {
      return false;
    }
    
    // Exclude "Did you mean" and spelling suggestions
    if (
      a.closest('.card-section') ||
      a.closest('.spell') ||
      a.closest('.spell-orig') ||
      a.closest('[data-spell]') ||
      a.closest('.med') ||
      a.textContent.includes('Did you mean:') ||
      a.textContent.includes('Showing results for')
    ) {
      return false;
    }
    
    // Exclude images, shopping, videos, maps, and other non-webpage results
    if (
      a.closest('.images_table') ||
      a.closest('.images_area') ||
      a.closest('.isch') ||
      a.closest('.shopping-carousel') ||
      a.closest('.pla-unit') ||
      a.closest('.commercial-unit-desktop-top') ||
      a.closest('.mnr-c.xpd') ||
      a.closest('.related-question-pair') ||
      a.closest('.video-carousel') ||
      a.closest('.video-section') ||
      a.closest('.video_results') ||
      a.closest('.maps') ||
      a.closest('.maps-results') ||
      a.closest('.local-results') ||
      a.closest('.place-result') ||
      a.closest('[aria-label*="location"]') ||
      a.closest('[data-local-result]') ||
      a.closest('[data-ved*="CAE"]') || // Image results have specific ved patterns
      a.href?.includes('/imgres?') ||
      a.href?.includes('/shopping/') ||
      a.href?.includes('/maps/') ||
      a.href?.includes('tbm=lcl') || // Local/maps search
      a.href?.includes('/search?') && a.href?.includes('tbm=isch') ||
      a.href?.includes('/search?') && a.href?.includes('tbm=vid') ||
      a.href?.includes('youtube.com/watch') ||
      a.href?.includes('youtu.be/') ||
      a.querySelector('img[data-src*="encrypted"]') || // Google's encrypted image thumbnails
      a.querySelector('.video-duration') || // Video duration indicators
      a.querySelector('[data-ved*="6ahUKEwi"]') && a.querySelector('img') // Video thumbnails
    ) {
      return false;
    }
    
    // Only include links that go to external websites (not Google internal links)
    if (!a.href || 
        a.href.includes('google.com/search') ||
        a.href.includes('google.com/url') ||
        a.href.startsWith('javascript:') ||
        a.href.startsWith('#') ||
        a.href === window.location.href) {
      return false;
    }
    
    // Skip only very specific location results (minimal filtering)
    if ((a.href && a.href.includes('/maps/')) ||
        (a.href && a.href.includes('tbm=lcl'))) {
      return false;
    }
    
    // Check if this is a business listing with hours/ratings
    const linkText = a.textContent || '';
    const hasBusinessHours = linkText.includes('Open ·') || linkText.includes('Closes ');
    const hasRating = linkText.includes('★') || /\d+\.\d+\s*\([\d,]+\)/.test(linkText);
    
    // Check parent element for business indicators
    const parentEl = a.parentElement;
    const parentText = parentEl ? parentEl.textContent : '';
    const isBusinessListing = (hasBusinessHours && hasRating) || 
                              (parentText.includes('Open ·') && parentText.includes('Closes ')) ||
                              a.closest('.rllt__details') ||
                              a.closest('[data-attrid*="kc:/location"]');
    
    if (isBusinessListing) {
      return false;
    }
    
    // Must have a visible title element
    const titleEl = a.querySelector('h3, div[role="heading"]');
    if (!titleEl) return false;
    
    // Exclude if the title text looks like a suggestion
    const titleText = titleEl.textContent.trim();
    if (titleText.includes('Did you mean') || titleText.includes('Showing results for')) {
      return false;
    }
    
    const key = a.href || a.getAttribute('href') || a.textContent.trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return filtered;
}

function addCounters() {
  if (!isGoogleSearchPage()) return;

  // Prevent simultaneous executions
  if (isProcessing) {
    console.log('[Counter] Already processing, skipping...');
    return;
  }
  isProcessing = true;

  // Pause observer to avoid self-triggered loops
  if (observerRef) observerRef.disconnect();

  // Check if this is a "load more" scenario vs a fresh page FIRST
  const existingCounters = document.querySelectorAll('.search-counter');
  const isLoadMore = existingCounters.length > 0;
  
  if (isLoadMore) {
    // Preserve existing counters and continue numbering
    preserveExistingCounters();
  } else {
    // Fresh page - recompute base index from URL and reset
    try {
      const u = new URL(window.location.href);
      let startParam = parseInt(u.searchParams.get('start') || '0', 10);
      
      // Also check for other pagination indicators
      const pageParam = parseInt(u.searchParams.get('page') || '1', 10);
      const offsetParam = parseInt(u.searchParams.get('offset') || '0', 10);
      
      // Calculate base index from various pagination methods
      if (startParam > 0) {
        baseIndex = startParam;
      } else if (pageParam > 1) {
        baseIndex = (pageParam - 1) * 10; // Assume 10 results per page
      } else if (offsetParam > 0) {
        baseIndex = offsetParam;
      } else {
        baseIndex = 0;
      }
      
    } catch (_) {
      baseIndex = 0;
    }
    globalCounter = baseIndex + 1;
    clearExistingCounters();
  }

  const anchors = getOrganicAnchors();

  // Early exit if no new results to process
  const unprocessedAnchors = anchors.filter(a => !processedResults.has(a.href));
  if (unprocessedAnchors.length === 0) {
    console.log('[Counter] No new results to process');
    isProcessing = false;
    if (observerRef) {
      observerRef.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false,
      });
    }
    return;
  }

  let added = 0;
  anchors.forEach((a) => {
    if (!a.isConnected) return;
    
    // Skip if this link already has a counter (preserve existing ones)
    if (processedResults.has(a.href)) return;
    
    // Try different container strategies for desktop vs mobile
    let container = a.closest('.yuRUbf') || a.closest('.g') || a.closest('.MjjYud') || a.parentElement;
    if (!container) return;

    // Avoid duplicates - check if container already has a counter
    if (container.querySelector('.search-counter')) return;

    // Detect mobile layout for adaptive positioning and container selection
    const isMobileLayout = window.innerWidth <= 768 || 
                          document.body.classList.contains('mobile') ||
                          document.querySelector('.mnr-c') ||
                          document.querySelector('.xpd') ||
                          navigator.userAgent.includes('Mobile') ||
                          document.querySelector('[data-ved*="mobile"]');
    
    console.log(`[Counter] Processing anchor: ${a.href}, Mobile layout: ${isMobileLayout}`);
    
    // For mobile view, try to find a better container
    if (isMobileLayout) {
      const mobileContainer = a.closest('.xpd') || 
                             a.closest('.mnr-c') || 
                             a.closest('.MjjYud') || 
                             a.closest('.g') || 
                             container;
      if (mobileContainer) {
        container = mobileContainer;
        console.log(`[Counter] Using mobile container: ${container.className}`);
      }
    }

    // Ensure container can host absolutely-positioned child
    const cs = window.getComputedStyle(container);
    if (cs.position === 'static') {
      container.style.position = 'relative';
    }

    const counter = document.createElement('span');
    counter.className = 'search-counter';
    counter.textContent = `#${globalCounter}`;
    
    // Simple big number counter design
    counter.style.position = 'absolute';
    
    if (isMobileLayout) {
      // Mobile positioning - top left corner
      counter.style.left = '12px';
      counter.style.top = '8px';
      counter.style.fontSize = '24px';
    } else {
      // Desktop positioning - top right corner
      counter.style.right = '8px';
      counter.style.top = '-6px';
      counter.style.fontSize = '20px';
    }
    
    counter.style.background = 'none';
    counter.style.color = '#1a73e8';
    counter.style.border = 'none';
    counter.style.padding = '0';
    counter.style.lineHeight = '1';
    counter.style.pointerEvents = 'none';
    counter.style.zIndex = '2147483647';
    counter.style.fontWeight = '900';
    counter.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    counter.style.textShadow = '1px 1px 2px rgba(0,0,0,0.3)';
    counter.style.transform = 'scale(1)';
    counter.style.transition = 'all 0.2s ease';
    counter.style.animation = 'counterPulse 0.6s ease-out';
    counter.style.textAlign = 'center';
    
    // Add CSS animation keyframes to document if not already added
    if (!document.querySelector('#counter-animations')) {
      const style = document.createElement('style');
      style.id = 'counter-animations';
      style.textContent = `
        @keyframes counterPulse {
          0% { transform: scale(0.8); opacity: 0; }
          50% { transform: scale(1.1); opacity: 0.8; }
          100% { transform: scale(1); opacity: 1; }
        }
        .search-counter:hover {
          transform: scale(1.05) !important;
        }
      `;
      document.head.appendChild(style);
    }

    container.appendChild(counter);
    processedResults.add(a.href);
    globalCounter++;
    added++;
  });

  // Last-resort fallback: directly label each visible h3 if nothing was added
  if (added === 0) {
    
    // Try multiple selectors for h3 elements
    const selectors = [
      '#search h3',
      '#rso h3', 
      '.g h3',
      '.MjjYud h3',
      '.tF2Cxc h3',
      'h3[role="heading"]',
      '[role="heading"]'
    ];
    
    let allH3s = [];
    selectors.forEach(selector => {
      const elements = Array.from(document.querySelectorAll(selector));
      allH3s = allH3s.concat(elements);
    });
    
    // Remove duplicates
    const uniqueH3s = [...new Set(allH3s)];
    
    uniqueH3s.forEach((h3) => {
      if (!h3.isConnected || h3.offsetParent === null) return;
      if (h3.closest('#topstuff, .kp-blk, .xpdopen, [data-text-ad], [data-overlay-ad], [class*="commercial-unit-"], [data-section-id*="local"], .local-results-container, .local-result')) return;
      if (h3.querySelector('.search-counter')) return;
      
      // Exclude "Did you mean" and spelling suggestions
      if (h3.closest('.card-section, .spell, .spell-orig, [data-spell], .med')) return;
      
      // Exclude images, shopping, videos, maps, and other non-webpage results
      if (h3.closest('.images_table, .images_area, .isch, .shopping-carousel, .pla-unit, .commercial-unit-desktop-top, .mnr-c.xpd, .related-question-pair, .video-carousel, .video-section, .video_results, .maps, .maps-results, .local-results, .place-result')) return;
      
      // Skip if it looks like a non-result heading
      const text = h3.textContent.trim();
      if (text.length < 5 || 
          text.includes('People also ask') || 
          text.includes('Related topics') ||
          text.includes('Did you mean') ||
          text.includes('Showing results for') ||
          text.includes('Including results for') ||
          text.includes('Search instead for') ||
          text.includes('See also') ||
          text.includes('Overview') ||
          text.includes('Images') ||
          text.includes('Videos') ||
          text.includes('Locations') ||
          text.includes('More locations')) return;
      
      // Skip only very specific location results (minimal filtering)
      const h3Text = h3.textContent.trim();
      const h3Parent = h3.parentElement;
      const parentText = h3Parent ? h3Parent.textContent : '';
      
      // Check if this is a business listing
      if ((h3Text.includes('Open ·') || h3Text.includes('Closes ')) ||
          (parentText.includes('Open ·') && parentText.includes('Closes ')) ||
          h3Text.includes('★') ||
          h3.closest('.rllt__details') ||
          h3.closest('[data-attrid*="kc:/location"]')) {
        return;
      }
      
      // Only add counter if this h3 is inside a link that goes to an external website
      const parentLink = h3.closest('a');
      if (!parentLink || 
          !parentLink.href ||
          parentLink.href.includes('google.com/search') ||
          parentLink.href.includes('google.com/url') ||
          parentLink.href.includes('youtube.com/watch') ||
          parentLink.href.includes('youtu.be/') ||
          parentLink.href.includes('tbm=vid') ||
          parentLink.href.includes('/maps/') ||
          parentLink.href.includes('tbm=lcl') ||
          parentLink.href.startsWith('javascript:') ||
          parentLink.href.startsWith('#')) return;
      
      const span = document.createElement('span');
      span.className = 'search-counter';
      span.textContent = `#${globalCounter}`;
      span.style.cssText = 'display:inline-block !important;margin-left:12px !important;background:none !important;color:#ffd700 !important;border:none !important;padding:4px 8px !important;font-size:28px !important;line-height:1.2 !important;pointer-events:none !important;font-weight:normal !important;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif !important;text-shadow:1px 1px 2px rgba(0,0,0,0.5) !important;z-index:999999 !important;text-align:center !important;min-width:40px !important;min-height:32px !important;animation:counterPulse 0.6s ease-out !important;';
      h3.appendChild(span);
      globalCounter++;
      added++;
    });
    
  }

  // Resume observing
  isProcessing = false;
  if (observerRef) {
    observerRef.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false,
    });
  }
  // Kick the watchdog in case rendering is delayed
  startWatchdog();
}

// Safety net: if no counters appear yet, keep trying briefly
let watchdogTimer = null;
function startWatchdog() {
  if (watchdogTimer) clearInterval(watchdogTimer);
  let attempts = 0;
  watchdogTimer = setInterval(() => {
    const hasCounters = document.querySelector('.search-counter');
    if (!hasCounters) {
      attempts++;
      console.log(`[Counter] Watchdog retry #${attempts}`);
      addCounters();
      if (attempts >= 6) { // try up to ~6 times (~6*250ms staggered by internal debounce)
        clearInterval(watchdogTimer);
      }
    } else {
      clearInterval(watchdogTimer);
    }
  }, 1000);
}

function resetCountersOnNewSearch() {
  // Check if this is a new search by looking for search input changes
  const searchInput = document.querySelector('input[name="q"]') || 
                     document.querySelector('textarea[name="q"]') ||
                     document.querySelector('#APjFqb');
  
  if (searchInput) {
    let lastSearchValue = searchInput.value;
    
    const checkForNewSearch = () => {
      if (searchInput.value !== lastSearchValue) {
        // For new searches, always clear everything
        clearExistingCounters();
        lastSearchValue = searchInput.value;
        setTimeout(addCounters, 500); // Delay to let results load
      }
    };
    
    searchInput.addEventListener('input', checkForNewSearch);
    
    // Also check for URL changes (back/forward navigation, pagination)
    let lastUrl = window.location.href;
    let lastStartParam = new URL(window.location.href).searchParams.get('start') || '0';
    
    setInterval(() => {
      const currentUrl = window.location.href;
      const currentStartParam = new URL(currentUrl).searchParams.get('start') || '0';
      const currentQuery = new URL(currentUrl).searchParams.get('q') || '';
      
      if (currentUrl !== lastUrl || currentStartParam !== lastStartParam) {
        // Check if this is a new search (query changed) vs pagination/load more
        const lastQuery = new URL(lastUrl).searchParams.get('q') || '';
        const isNewSearch = currentQuery !== lastQuery;
        
        if (isNewSearch) {
          clearExistingCounters();
        }
        
        lastUrl = currentUrl;
        lastStartParam = currentStartParam;
        setTimeout(addCounters, 1000);
      }
    }, 500); // Check more frequently for pagination changes
  }
}

// Initialize
function init() {
  console.log("Google Search Counter Extension initialized");
  if (!isGoogleSearchPage()) {
    console.log('[Counter] Not a Google search page, idle.');
    return;
  }
  
  
  // Determine starting index from URL (start=10 -> begin at 11)
  const computeBaseIndex = () => {
    try {
      const u = new URL(window.location.href);
      const startParam = parseInt(u.searchParams.get('start') || '0', 10);
      return Number.isFinite(startParam) && startParam > 0 ? startParam : 0;
    } catch (e) { return 0; }
  };
  baseIndex = computeBaseIndex();
  globalCounter = baseIndex + 1;

  // Clear any existing counters first
  clearExistingCounters();
  
  // Add counters after a short delay to ensure page is loaded
  setTimeout(addCounters, 1000);
  setTimeout(startWatchdog, 1200);
  
  // Set up search reset detection
  resetCountersOnNewSearch();
  
  // Listen for layout changes (mobile view toggle)
  let lastViewportWidth = window.innerWidth;
  let lastUserAgent = navigator.userAgent;
  
  const checkLayoutChange = () => {
    const currentWidth = window.innerWidth;
    const currentUA = navigator.userAgent;
    
    // Check if viewport changed significantly (mobile toggle)
    if (Math.abs(currentWidth - lastViewportWidth) > 100 || currentUA !== lastUserAgent) {
      console.log(`[Counter] Layout change detected: ${lastViewportWidth} -> ${currentWidth}`);
      console.log(`[Counter] User agent change: ${lastUserAgent.includes('Mobile')} -> ${currentUA.includes('Mobile')}`);
      lastViewportWidth = currentWidth;
      lastUserAgent = currentUA;
      
      // Clear existing counters and re-add after layout change
      clearExistingCounters();
      setTimeout(() => {
        console.log('[Counter] Re-adding counters after layout change');
        addCounters();
      }, 1500);
    }
  };
  
  // Check for layout changes
  window.addEventListener('resize', checkLayoutChange);
  
  // Periodic check for layout changes (every 2 seconds)
  setInterval(() => {
    checkLayoutChange();
    
    // Also check if we lost counters and need to re-add them
    const hasCounters = document.querySelectorAll('.search-counter').length > 0;
    const hasResults = document.querySelectorAll('#search a[href], #rso a[href]').length > 0;
    
    if (!hasCounters && hasResults) {
      console.log('[Counter] Periodic check: No counters found but results exist, re-adding');
      addCounters();
    }
  }, 2000);
  
  
  // Set up mutation observer for dynamic content and pagination
  observerRef = new MutationObserver((mutations) => {
    let shouldUpdate = false;
    for (const m of mutations) {
      if (m.type !== 'childList') continue;
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (
          n.matches?.('#search, #rso, .MjjYud, .g, .tF2Cxc, .yuRUbf') ||
          n.querySelector?.('#search #rso, #search .MjjYud, #search .g, #search .tF2Cxc, #search .yuRUbf') ||
          n.matches?.('.AaVjTc') || // "See more" button container
          n.querySelector?.('.AaVjTc') || // "See more" results container
          n.matches?.('.mnr-c, .xpd') || // Mobile containers
          n.querySelector?.('.mnr-c, .xpd') // Mobile containers
        ) {
          shouldUpdate = true;
          break;
        }
      }
      if (shouldUpdate) break;
    }
    if (shouldUpdate) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (!isProcessing) {
          console.log('[Counter] DOM mutation detected, re-adding counters');
          addCounters();
        }
      }, 500);
    }
  });
  
  // Also observe body class changes (mobile view toggle)
  const bodyObserver = new MutationObserver((mutations) => {
    let layoutChanged = false;
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && 
          (mutation.attributeName === 'class' || mutation.attributeName === 'style')) {
        layoutChanged = true;
      }
    });
    if (layoutChanged) {
      console.log('[Counter] Body class/style change detected, re-adding counters');
      setTimeout(addCounters, 1000);
    }
  });
  
  bodyObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ['class', 'style']
  });
  
  observerRef.observe(document.body, { 
    childList: true, 
    subtree: true,
    attributes: false,
    characterData: false
  });
}

// Manual trigger function for background script
window.manualAddCounters = function() {
  console.log('[Counter] Manual trigger activated');
  clearExistingCounters();
  setTimeout(addCounters, 500);
};

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// In case some results render after onload, run once more
window.addEventListener('load', () => setTimeout(addCounters, 800));
