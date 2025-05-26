from flask import Flask, send_from_directory
import os

app = Flask(__name__)

# Serve the index.html from the root directory
@app.route('/')
@app.route('/index.html')
def serve_index():
    return send_from_directory('.', 'index.html')

# Serve CSS files from the 'css' directory
@app.route('/css/<path:filename>')
def serve_css(filename):
    return send_from_directory('css', filename)

# Serve JavaScript files from the 'js' directory
@app.route('/js/<path:filename>')
def serve_js(filename):
    return send_from_directory('js', filename)

# Serve image files from the 'images' directory
@app.route('/images/<path:filename>')
def serve_images(filename):
    return send_from_directory('images', filename)

# Serve favicon.ico from the root directory
@app.route('/favicon.ico')
def serve_favicon():
    return send_from_directory('.', 'favicon.ico')

# Serve login.html from the root directory
@app.route('/login.html')
def serve_login():
    return send_from_directory('.', 'login.html')

# Serve register.html from the root directory
@app.route('/register.html')
def serve_register():
    return send_from_directory('.', 'register.html')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 7860))
    app.run(host='0.0.0.0', port=port, debug=False)