// webpack.config.js

const path = require('path');

module.exports = {
    entry: {
        service_worker: './src/javascripts/service_worker.js',
        options: './src/javascripts/options.js',
    },
    output: {
        filename: '[name].min.js',
        path: path.resolve(__dirname, 'dist/'),
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                loader: 'babel-loader'
            },
        ],
    },
};
