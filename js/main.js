function ready(fn) {
  if (document.readyState != 'loading'){
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}

function linkifyPostThumbnails() {
    var elements = document.querySelectorAll(".post img");
    Array.prototype.forEach.call(elements, function(el, i){
        if(el.src.includes('_thumb.')){
            el.style.cursor = 'pointer';
            el.addEventListener('click', function() {
                window.location = el.src.replace('_thumb.', '.')
            });

        }
    });
}

// Authored marks (underline, highlight, annotation) draw themselves once,
// when they scroll into view.
function drawMarksOnView() {
    Array.prototype.forEach.call(document.querySelectorAll('.main-principles li strong'), function(el) { el.classList.add('mark-highlight'); });
    Array.prototype.forEach.call(document.querySelectorAll('.main-principles li em'), function(el) { el.classList.add('mark-underline'); });
    var marks = document.querySelectorAll('.mark-underline, .mark-highlight, .annotation');
    if (!marks.length) return;
    if (!('IntersectionObserver' in window)) return;
    document.documentElement.classList.add('marks-live');
    var io = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-drawn');
                io.unobserve(entry.target);
            }
        });
    }, { threshold: 0.6 });
    Array.prototype.forEach.call(marks, function(el) { io.observe(el); });
}

ready(function() {
    linkifyPostThumbnails();
    drawMarksOnView();
});


