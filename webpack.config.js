const path = require('path')

const commonConfig = {
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: '[name].js',
    // The renderer runs with nodeIntegration disabled (a browser context), so
    // Node's `global` doesn't exist. Point webpack's runtime at `globalThis`,
    // which is available in both the renderer and the main/preload processes.
    globalObject: 'globalThis'
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader'
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.ts', '.tsx', '.jsx', '.json']
  }
}

const HtmlWebpackPlugin = require('html-webpack-plugin')
module.exports = [
  {
    target: 'electron-main',
    entry: { main: './src/main/index.ts' },
    node: {
      __dirname: false
    },
    ...commonConfig
  },
  {
    target: 'electron-preload',
    entry: { preload: './src/main/preload.ts' },
    node: {
      __dirname: false
    },
    ...commonConfig
  },
  {
    // The renderer runs with nodeIntegration disabled, so it's a plain browser
    // context. Using the 'web' target (instead of 'electron-renderer') stops
    // webpack from emitting runtime `require()` calls, which don't exist here.
    target: 'web',
    entry: { gui: './src/gui/index.tsx' },
    plugins: [new HtmlWebpackPlugin({
      template: 'src/gui/index.html'
    })],
    devServer: {
      static: {
        directory: path.resolve(__dirname, 'build')
      },
      port: 8080,
      hot: true
    },
    ...commonConfig
  }
]