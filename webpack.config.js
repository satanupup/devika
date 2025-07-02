const path = require('path');

/**
 * Webpack 配置文件
 * 用於構建 VS Code 擴展
 */
module.exports = {
  target: 'node', // VS Code 擴展運行在 Node.js 環境
  mode: 'none', // 由 package.json 腳本控制

  entry: './src/extension.ts', // 擴展入口點
  output: {
    path: path.resolve(__dirname, 'out'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2'
  },

  externals: {
    vscode: 'commonjs vscode' // VS Code API 不應該被打包
  },

  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },

  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              compilerOptions: {
                module: 'es6' // 輸出 ES6 模組以便 webpack 進行樹搖
              }
            }
          }
        ]
      }
    ]
  },

  devtool: 'nosources-source-map', // 創建 source map 但不包含源代碼

  infrastructureLogging: {
    level: "log", // 啟用問題匹配器的日誌記錄
  },

  optimization: {
    minimize: false, // 不壓縮，保持可讀性
    usedExports: true, // 啟用樹搖
    sideEffects: false // 標記為無副作用
  }
};
