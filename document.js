// Renders the policy from its Markdown source, so the text is edited in one place.
document.addEventListener('DOMContentLoaded', () => {
    const target = document.getElementById('document');
    if (!target) return;
    const source = target.dataset.source;
    fetch(source)
        .then(response => {
            if (!response.ok) throw new Error('Request failed');
            return response.text();
        })
        .then(text => {
            target.innerHTML = marked.parse(text);
        })
        .catch(() => {
            target.innerHTML = '<h1>' + document.title.split(' - ')[0] + '</h1>' +
                '<p>This page could not be loaded. Read the <a href="' + source + '">plain-text version</a>.</p>';
        });
});
