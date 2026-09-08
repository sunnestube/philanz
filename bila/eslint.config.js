// Flat ESLint config mirroring bila/tslint.json (indent 4, single quotes, bal- selectors).
// TSLint is deprecated; this is the runnable counterpart for Angular 21.
const tslintParity = {
    files: ['**/*.ts'],
    rules: {
        indent: ['error', 4],
        quotes: ['error', 'single', {avoidEscape: true}],
        semi: ['error', 'always'],
        eqeqeq: ['error', 'smart'],
        'prefer-const': 'error',
        'no-var': 'error',
        'no-debugger': 'error',
        'no-console': ['warn', {allow: ['warn', 'error']}],
        'max-len': ['warn', {code: 140, ignoreUrls: true, ignoreStrings: true, ignoreTemplateLiterals: true}]
    }
};

module.exports = [tslintParity];
