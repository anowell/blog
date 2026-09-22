// Groups `**Speaker:**` paragraphs (and whatever follows them) into labeled
// turns. Figures marked `wide` sit between turns instead of inside one, and
// an <hr> ends the grouping.
function buildTranscript() {
    var body = document.querySelector('.post-transcript .post-body');
    if (!body) return;
    var turn = null;
    Array.prototype.slice.call(body.children).forEach(function(node) {
        if (node.classList.contains('wide') || node.tagName === 'HR') {
            turn = null;
            return;
        }
        var lead = node.tagName === 'P' && node.firstChild === node.firstElementChild && node.firstElementChild;
        var name = lead && lead.tagName === 'STRONG' && /^(.+):$/.exec(lead.textContent.trim());
        if (name) {
            lead.remove();
            if (node.firstChild && node.firstChild.nodeType === 3) {
                node.firstChild.textContent = node.firstChild.textContent.replace(/^\s+/, '');
            }
            turn = document.createElement('div');
            turn.className = 'turn';
            turn.setAttribute('data-who', name[1].toLowerCase().replace(/[^a-z0-9]+/g, '-'));
            var who = document.createElement('span');
            who.className = 'who';
            who.textContent = name[1];
            var say = document.createElement('div');
            say.className = 'say';
            turn.appendChild(who);
            turn.appendChild(say);
            body.insertBefore(turn, node);
            if (node.textContent.trim() === '' && !node.firstElementChild) {
                node.remove();
                return;
            }
        }
        if (turn) turn.querySelector('.say').appendChild(node);
    });
}

buildTranscript();
