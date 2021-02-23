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

ready(function() {
    linkifyPostThumbnails();
});


