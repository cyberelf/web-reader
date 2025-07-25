const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    content: './src/main.ts',
    background: './src/background.ts',
    popup: './src/popup.ts'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js'
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: [
          /node_modules/,
          /src\/__tests__/,
          /\.test\.ts$/
        ]
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js'],
    fallback: {
      // Provide fallbacks for Node.js modules that might be used by mermaid
      "path": false,
      "fs": false,
      "util": false,
      "stream": false,
      "buffer": false,
      "crypto": false,
      "process": false
    }
  },
  optimization: {
    // Completely disable all code splitting
    splitChunks: false,
    minimize: true
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: 'src/manifest.json', to: 'manifest.json' },
        { from: 'icons', to: 'icons' },
        { from: 'src/popup.html', to: 'popup.html' },
        { from: 'src/styles.css', to: 'styles.css' },
        { from: 'src/settings.css', to: 'settings.css' }
      ]
    })
  ]
}; 