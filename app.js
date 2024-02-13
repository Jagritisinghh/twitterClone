const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

let db = null;

const dbPath = path.join(__dirname, "twitterClone.db");
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log("Server running at http://localhost:3000");
    });
  } catch (e) {
    process.exit(1);
    console.log(e);
  }
};

initializeDbAndServer();

// get following people ids of user
const getFollowingUserId = async (username) => {
  const getTheFollowingUSerQuery = `
      SELECT following_user_id FROM follower INNER JOIN user ON user.user_id=follower.follower_user_id WHERE user.username='${username}';`;
  const followingUserQuery = await db.all(getTheFollowingUSerQuery);
  console.log("following user query", followingUserQuery);
  const arrayOfIds = followingUserQuery.map((each) => each.following_user_id);

  return arrayOfIds;
};

// Authenticate JWT Token

const authenticateJwtToken = (req, res, next) => {
  let jwtToken;
  let authHeader = req.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
    // console.log(jwtToken);
  }
  if (jwtToken) {
    jwt.verify(jwtToken, "secret_token", (error, payload) => {
      if (error) {
        res.status(401).send("Invalid JWT Token");
      } else {
        console.log("aja bhyii", payload.id);
        req.username = payload.username;
        req.userId = payload.userId;
        console.log("payload at verification", payload);
        next();
      }
    });
  } else {
    res.status(401).send("Invalid JWT Token");
  }
};

// Tweet access verification

const tweetAccessVerification = async (req, res, next) => {
  const { userId } = req;
  const { tweetId } = req.params;
  const tweetAccessQuery = `
    SELECT * from tweet INNER JOIN follower ON tweet.user_id=follower.following_user_id WHERE tweetId='${tweetId} AND follower_user_id='${userId}';`;
  const tweet = await db.all(tweetAccessQuery);
  console.log(tweet);
  if (tweet === undefined) {
    res.status(401);
    res.send("Invalid request");
  } else {
    next();
  }
};

// API-1, Register User

app.post("/register/", async (req, res) => {
  const { username, password, name, gender } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const userQuery = `select * from user where username='${username}';`;
  const dbUser = await db.get(userQuery);

  //   console.log("user register", dbUser);
  //   console.log(password, hashedPassword);

  //   Create new User
  if (dbUser === undefined) {
    if (password.length < 6) {
      res.status(400);
      res.send("Password is too short");
    } else {
      const createUserQuery = `INSERT into user (name,username,password,gender) VALUES ('${name}','${username}','${hashedPassword}','${gender}');`;
      const newUser = await db.run(createUserQuery);
      res.status(200).send("User created successfully");
    }
    // console.log(newUser);
  } else {
    //   User already exists
    res.status(400).send("User already exists");
  }
});

//API-2 Login

app.post("/login/", async (req, res) => {
  const { username, password } = req.body;
  const userQuery = `select * from user where username='${username}';`;
  const dbUser = await db.get(userQuery);
  console.log(dbUser.user_id);
  //   console.log(dbUser.password, password);
  if (dbUser !== undefined) {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched) {
      let payload = { username, id: dbUser.user_id };
      console.log(payload);
      const jwtToken = await jwt.sign({ username, id: dbUser.user_id });
      res.send({ jwtToken });
      //   res.send("Login success");
    } else {
      res.status(400).send("Invalid password");
    }
  } else {
    res.status(400);
    res.send("Invalid user");
  }
});

// API-3

app.get("/user/tweets/feed/", authenticateJwtToken, async (req, res) => {
  const { username } = req;
  console.log("user", username);
  const userFollowing = await getFollowingUserId(username);
  console.log(userFollowing);
  const getLatestTweetsQuery = `
          SELECT
         username,
          tweet,
          date_time AS dateTime
        FROM
          user
          INNER JOIN tweet ON user.user_id=tweet.user_id
          WHERE
          user.user_id IN (${userFollowing})

        ORDER BY
          date_time DESC
        LIMIT
          4;`;
  const getLatestTweets = await db.all(getLatestTweetsQuery);
  res.send(getLatestTweets);
});

// API-4

app.get("/user/following/", authenticateJwtToken, async (req, res) => {
  //   const { username } = req;
  //   console.log(req);
  //   const getUserFoll`owingQuery = `select name from user INNER JOIN follower ON user.user_id=follower.following_user_id WHERE follower_user_id ='${userId}'; `;
  //   const getUserFollowing = await db.all(getUserFollowingQuery);
  //   res.send(getUserFollowing);
});

// API-5

app.get("/user/followers/", authenticateJwtToken, async (req, res) => {
  console.log("user followings");

  const getUserFollowingQuery = `select distinct name from user JOIN follower where user.user_id=follower.following_user_id; `;
  const getUserFollowing = await db.all(getUserFollowingQuery);
  res.send(getUserFollowing);
});

// API-6
app.get("/tweets/:tweetId/", authenticateJwtToken, async (req, res) => {
  const { tweetId } = req.params;

  const getUserTweet = `SELECT
    t.tweet AS tweet,
    COUNT(l.user_id) AS likes,
    COUNT(r.reply_id) AS replies,
    t.date_time AS dateTime
FROM
    tweet AS t
LEFT JOIN
    like AS l ON t.tweet_id = l.tweet_id
LEFT JOIN
    reply AS r ON t.tweet_id = r.tweet_id
JOIN
    follower AS f ON t.user_id = f.following_user_id
WHERE
    f.follower_user_id = ?
GROUP BY
    t.tweet_id;
;`;
  const userTweet = await db.all(getUserTweet);
  res.send(userTweet);
});

// API-7

app.get("/tweets/:tweetId/likes/", authenticateJwtToken, async (req, res) => {
  console.log("Api-7");
});

// API-8
app.get("/tweets/:tweetId/replies/", authenticateJwtToken, async (req, res) => {
  console.log("api-8");
});

// ApI-9
app.get("/user/tweets/", authenticateJwtToken, async (req, res) => {
  console.log("api-9");
});

// API-10
app.post("/user/tweets/", authenticateJwtToken, async (req, res) => {
  const { tweet } = req.body;
  const postTweetQuery = `
  INSERT INTO tweet(tweet) VALUES('${tweet}');`;
  const postTweet = await db.run(postTweetQuery);
  res.send("Created a Tweet");
  console.log(postTweet);
});

// API-11
app.delete("/tweets/:tweetId/", authenticateJwtToken, async (req, res) => {
  const { tweetId } = req.params;
  const deleteTweetQuery = `DELETE FROM tweet WHERE tweet_id='${tweetId}';`;
  await db.run(deleteTweetQuery);
  res.send("Tweet Removed");
});

module.exports = app;
