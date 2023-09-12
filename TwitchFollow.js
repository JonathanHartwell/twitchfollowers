const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

const CLIENT_ID = process.env.TWITCH_CLIENT_ID || 'your_client_id';
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || 'your_client_secret';
const RATE_LIMIT_DELAY = 1; // 1 ms delay between requests
const TOP_USERS_COUNT = 25;
const usernamesFilePath = './usernames.txt';
let usernames = [];

// get access token from https://dev.twitch.tv/docs/api/
async function getAccessToken() {
  const url = 'https://id.twitch.tv/oauth2/token';
  const params = {
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: 'client_credentials',
  };

  try {
    const response = await axios.post(url, null, { params });
    return response.data.access_token;
  } catch (theseHands) {
    console.error('Error getting access token:', theseHands.message);
    return null;
  }
}

//run through the usernames in usernames.txt and asks twitch API for data about them.
async function getUserData(username, access_token) {
  const headers = {
    'Client-ID': CLIENT_ID,
    Authorization: `Bearer ${access_token}`,
  };
  const url = `https://api.twitch.tv/helix/users?login=${username}`;

  try {
    const response = await axios.get(url, { headers });
    // console.log(response.data.data[0]) //used this to console log the data to check if I was getting everything
    return response.data.data[0];
  } catch (theseHands) {
    console.error(`Error getting user data for ${username}:`, theseHands.message);
    return null;
  }
}

//this uses the userId we collected from the getUserData function to get the number of followers each user has.
async function getFollowerCount(broadcasterId, access_token, userIdToCheck) {
  const headers = {
    'Client-ID': CLIENT_ID,
    Authorization: `Bearer ${access_token}`,
  };
  const params = {
    broadcaster_id: broadcasterId,
    user_id: userIdToCheck, // Optional: If specified, check if this user follows the broadcaster
  };
  const url = 'https://api.twitch.tv/helix/channels/followers';

  try {
    const response = await axios.get(url, { headers, params });
    return response.data.total || 0;
  } catch (theseHands) {
    // Handle errors as mentioned in the API documentation
    if (theseHands.response) {
      // Handle error responses
      if (theseHands.response.status === 410) {
        console.error(`User or broadcaster has been removed or doesn't exist.`);
      } else if (theseHands.response.status === 429) {
        console.error(`Rate limit exceeded. Retry after ${theseHands.response.headers['retry-after']} seconds.`);
      } else {
        console.error(`Error getting follower count: ${theseHands.message}`);
      }
    } else {
      // Handle network errors
      console.error(`Network error while getting follower count: ${theseHands.message}`);
    }
    return 0;
  }
}

// loops through our data collects the usernames and follower count and adds any usernames with more one or more followers into the topUsers array
async function processUsernames(usernames, access_token) {
  const topUsers = [];

  for (const username of usernames) {
    const userData = await getUserData(username, access_token);

    if (userData) {
      const followerCount = await getFollowerCount(userData.id, access_token);
      console.log(`Follower count for ${username}: ${followerCount}`);

      if (followerCount > 0) {
        topUsers.push({ username, followerCount });
      }
    }

    // Introduce rate limiting between requests to prevent rate limit error from twitch's API
    await delay(RATE_LIMIT_DELAY); //turns out I did not need it though
  }

  //sorts results in descending order
  topUsers.sort((a, b) => b.followerCount - a.followerCount);


  // uses the Top_USERS_COUNT const to trim the array and console log the 25 users with the most followers and their follower count. if there are less than 25 users it will console log all the users.
  const logCount = Math.min(topUsers.length, TOP_USERS_COUNT);
  for (let i = 0; i < logCount; i++) {
    console.log(`Top ${i + 1}: ${topUsers[i].username} with ${topUsers[i].followerCount} followers`);
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// gets the users from usernames.txt and puts them into an array of individual usernames.
try {
  const fileContent = fs.readFileSync(usernamesFilePath, 'utf8');
  usernames = fileContent.split('\n').map(line => line.trim());
} catch (theseHands) {
  console.error('Error reading usernames file:', theseHands.message);
}

getAccessToken()
  .then(access_token => {
    if (access_token) {
      processUsernames(usernames, access_token);
    }
  })
  .catch(theseHands => {
    console.error('Error getting access token:', theseHands.message);
  });
