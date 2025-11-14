from pathlib import Path


def main():
    root = Path('.').resolve()
    src = root / 'templates' / 'index.html'
    dst = root / 'templates' / 'index_static.html'
    if not src.exists():
        print('templates/index.html not found; skipping prepare_index_static')
        return
    txt = src.read_text(encoding='utf-8')
    txt = txt.replace(
        'window.ASS_PLAYER_CONFIG = {{ ASS_PLAYER_CONFIG | tojson | safe }};',
        'window.ASS_PLAYER_CONFIG = {"REPORT_TIMEOUT_MS": 3000};',
    )
    txt = txt.replace("{{ url_for('static', filename='css/main.css') }}", '/static/css/main.css')
    txt = txt.replace("{{ url_for('static', filename='css/layout.css') }}", '/static/css/layout.css')
    txt = txt.replace("{{ url_for('static', filename='css/fullscreen.css') }}", '/static/css/fullscreen.css')
    txt = txt.replace("{{ url_for('static', filename='css/components.css') }}", '/static/css/components.css')
    txt = txt.replace("{{ url_for('static', filename='js/modules/main.js') }}", '/static/js/modules/main.js')
    dst.write_text(txt, encoding='utf-8')
    print('Wrote templates/index_static.html')


if __name__ == '__main__':
    main()
