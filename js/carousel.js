function initCarousels() {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    Array.prototype.forEach.call(document.querySelectorAll('[data-carousel]'), function(root) {
        var slides = root.querySelectorAll('.slide');
        if (slides.length < 2) return;
        var title = root.querySelector('.codeframe-title');
        var interval = parseInt(root.getAttribute('data-interval'), 10) || 6000;
        var dots = document.createElement('div');
        dots.className = 'dots';
        var current = 0, timer = null;

        Array.prototype.forEach.call(slides, function(slide, n) {
            var dot = document.createElement('button');
            dot.type = 'button';
            dot.setAttribute('aria-label', slide.getAttribute('data-title') || ('Slide ' + (n + 1)));
            dot.addEventListener('click', function() { show(n); restart(); });
            dots.appendChild(dot);
        });
        root.appendChild(dots);

        function show(n) {
            current = n;
            Array.prototype.forEach.call(slides, function(slide, k) {
                slide.classList.toggle('is-active', k === n);
                slide.setAttribute('aria-hidden', k === n ? 'false' : 'true');
            });
            Array.prototype.forEach.call(dots.children, function(dot, k) {
                dot.classList.toggle('is-active', k === n);
            });
            var t = slides[n].getAttribute('data-title');
            if (title && t) title.textContent = t;
        }
        function stop() { if (timer) { clearInterval(timer); timer = null; } }
        function restart() {
            stop();
            if (reduce) return;
            timer = setInterval(function() { show((current + 1) % slides.length); }, interval);
        }
        root.addEventListener('mouseenter', stop);
        root.addEventListener('mouseleave', restart);
        show(0);
        restart();
    });
}

function initCasts() {
    if (!window.AsciinemaPlayer) return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    Array.prototype.forEach.call(document.querySelectorAll('.cast[data-cast]'), function(el) {
        AsciinemaPlayer.create(el.getAttribute('data-cast'), el, {
            cols: parseInt(el.getAttribute('data-cols'), 10) || 100,
            rows: parseInt(el.getAttribute('data-rows'), 10) || 24,
            fit: 'width',
            autoPlay: !reduce,
            loop: true,
            idleTimeLimit: 1.5,
            poster: 'npt:3',
            theme: 'blog',
            terminalFontFamily: "'IBM Plex Mono', Menlo, Consolas, monospace"
        });
    });
}

(function() {
    function start() {
        if (window.hljs) hljs.highlightAll();
        initCarousels();
        initCasts();
    }
    if (document.readyState !== 'loading') start();
    else document.addEventListener('DOMContentLoaded', start);
})();
