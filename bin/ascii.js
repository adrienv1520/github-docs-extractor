import figlet from 'figlet';
import gradient from 'gradient-string';

import packageJson from '../package.json' with { type: 'json' };

/**
 * Display a success message in ascii art and color gradient.
 * @returns {undefined}
 */
function displaySuccessMessage() {
  const successText = figlet.textSync('Success !', {
    font: 'miniwi',
  });

  const styledSuccess = gradient(['lime', 'green'])(successText);

  console.log('\n');
  /* eslint-disable-next-line security-node/detect-crlf */
  console.log(styledSuccess);
}

/**
 * Display the cli banner in ascii art and color gradient.
 * @returns {undefined}
 */
function displayWelcomeBanner() {
  const bannerText = figlet.textSync('GDE', {
    font: 'ANSI Shadow',
    horizontalLayout: 'default',
    verticalLayout: 'default',
    whitespaceBreak: true,
    width: 80,
  });
  const styledBanner = gradient(['#0d7ad8ff', '#31f8ffff'])(bannerText);
  const description = gradient(['#0d7ad8ff', '#31f8ffff'])(`  ${slugToTitle(packageJson.name)}`);
  console.log('\n');
  /* eslint-disable security-node/detect-crlf */
  console.log(styledBanner);
  console.log(description);
  /* eslint-enable security-node/detect-crlf */
  console.log('\n');
}

/**
 * Turns a slug into a readable title with first letters in uppercase.
 * @returns {string}
 */
function slugToTitle(slug) {
  return slug
    ?.replaceAll(/[-_.]+/g, ' ')
    .split(' ')
    .map((word) => {
      if (word.toLowerCase() === 'github') return 'GitHub';
      return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
    })
    .join(' ');
}

export default {
  displaySuccessMessage,
  displayWelcomeBanner,
};
