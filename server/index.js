const keys =require('./keys');


// Express App Setup
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());


// Postgres Client Setup
const { Pool } = require('pg');
const pgClient = new Pool({
  user: keys.pgUser,
  host: keys.pgHost,
  database: keys.pgDatabase,
  password: keys.pgPassword,
  port: keys.pgPort
});
pgClient.on('error', () => console.log('Lost PG connection'));

// So we're going to create a table inside the database to house that information.
pgClient
  .query('CREATE TABLE IF NOT EXISTS values (number INT)')
  .catch(err => console.log(err));


// Redis Client Setup
const redis = require('redis');
const redisClient = redis.createClient({
  host: keys.redisHost,
  port: keys.redisPort,
  retry_strategy: () => 1000
});

// https://www.udemy.com/docker-and-kubernetes-the-complete-guide/learn/v4/t/lecture/11437248?start=120
// is turned into a connection that's going to listen or subscribe or publish information it cannot be used for other purposes.
const redisPublisher = redisClient.duplicate();


// Express route handlers
app.get('/', (req, res) => {
  res.send('Hi');
});

app.get('/values/all', async (req, res) => {
  const values = await pgClient.query('SELECT * FROM values');

  res.send(values.rows);
});

app.get('/values/current', (req, res) => {
  // 1. essentially means look at a hash value inside the rattusinstance and just get all the information from it's the hash that we're going to look at is called values.
  // 2. Unfortunately the redis library for note just doesn't have out-of-the-box promise support which iswhy we have to use callbacks as opposed to making use of the nice async away syntax.
  redisClient.hgetall('values', (err, values) => {
    res.send(values);
  });
});

app.post('/values', async (req, res) => {
  const index = req.body.index;

  if (parseInt(index) > 40) {
    return res.status(422).send('Index too high')
  }

  redisClient.hset('values', index, 'Nothing yet!');
  // So this right here is going to be the message that gets sent over to that worker process. It's going to wake up the worker process
  redisPublisher.publish('insert', index);
  pgClient.query('INSERT INTO values(number) VALUES($1)', [index])

  res.send({ working: true });
});

app.listen(5000, err => {
  console.log('Listerning on port 5000');
});