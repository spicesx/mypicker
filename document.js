// Renders the policy from its Markdown source, so the text is edited in one place.
// While the text arrives, the card grows smoothly to its new height and the text fades in.
document.addEventListener('DOMContentLoaded', () => {
    const target = document.getElementById('document');
    if (!target) return;
    const card = target.closest('.container');
    const source = target.dataset.source;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function show(html) {
        if (reduceMotion || !card) {
            target.innerHTML = html;
            return;
        }
        // Hold the card at its loading height, swap in the text, then grow to the measured height.
        const from = card.getBoundingClientRect().height;
        card.style.height = from + 'px';
        card.style.overflow = 'hidden';
        target.classList.add('is-arriving');
        target.innerHTML = html;
        card.style.height = 'auto';
        const natural = card.getBoundingClientRect().height;
        // Grow only as far as the bottom of the screen, so the whole movement is visible; the rest of the card is
        // below the screen and takes its full height afterwards without anyone seeing a jump.
        const screenBottom = window.innerHeight - card.getBoundingClientRect().top + 24;
        const to = Math.min(natural, Math.max(from, screenBottom));
        card.style.height = from + 'px';
        void card.offsetHeight;
        card.classList.add('is-growing');
        card.style.height = to + 'px';
        target.classList.remove('is-arriving');

        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            // Back to natural height, so resizing the window or zooming text still fits.
            card.classList.remove('is-growing');
            card.style.height = '';
            card.style.overflow = '';
        };
        card.addEventListener('transitionend', event => {
            if (event.target === card && event.propertyName === 'height') finish();
        });
        setTimeout(finish, 1000);
    }

    fetch(source)
        .then(response => {
            if (!response.ok) throw new Error('Request failed');
            return response.text();
        })
        .then(text => show(marked.parse(text)))
        .catch(() => {
            show('<h1>' + document.title.split(' - ')[0] + '</h1>' +
                '<p>This page could not be loaded. Read the <a href="' + source + '">plain-text version</a>.</p>');
        });
});
