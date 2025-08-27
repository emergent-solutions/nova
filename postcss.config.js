// postcss.config.js
import postcssImport from 'postcss-import';

export default {
  plugins: [
    postcssImport({
      path: ['node_modules']
    }),
    // other plugins...
  ]
};