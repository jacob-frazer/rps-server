const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const port = process.env.PORT || 4001;
const index = require("./routes/index");

const app = express();
app.use(index);

const server = http.createServer(app);

const io = socketIo(server); // < Interesting!

let playerChoice = {}  // this will need to be specific to each pair of players (room?)
let currentRooms = {} // list of all matched/unmatched players and rooms

let roomInt = 0
let i = 0

let gamesObj = {}
let userRooms = {}

io.on("connection", socket => {

    // incremement room number every 2 joins
    roomInt = Math.floor(i)
    i+=0.5

    /*//Increase roomInt if 2 clients are present in a room - this will be the pairing for RPS - implement some decrement for when a player leaves?
    if(io.nsps['/'].adapter.rooms["room-"+roomInt] && io.nsps['/'].adapter.rooms["room-"+roomInt].length > 1) roomInt++; */
    socket.join("room-"+roomInt);
    io.sockets.in("room-"+roomInt).emit('connectToRoom', "You are in room no. "+roomInt);

    userRooms[socket.id] = roomInt  // build up players and what room they're in

    socket.emit('giveID', [roomInt, socket.id])    // give the id of the socket and the room it is in?

    if (!gamesObj[roomInt]) {           // if room is undefined aka not build/populated yet make it
      gamesObj[roomInt] = {"choicesSubmitted":0, "players":{}}
    }
    gamesObj[roomInt]["players"][socket.id] = {"score":0, "choice": null}    // set up the room to track IDs playing and current win score!

    socket.on("hello", playerID => {
      console.log("Hello listener fired!")
      console.log(playerID)
      socket.broadcast.emit("hello", playerID)
    });

    console.log("New client connected. There are " + io.engine.clientsCount + " clients.")

    socket.on("disconnect", () => {
      // needs something to delete out name and reset room when they leave!
      delete gamesObj[userRooms[socket.id]]["players"][socket.id]
      console.log("Client disconnected")});

    socket.on("choice", data => {
      console.log("the choice is received!")
      
      gamesObj[data.room]["players"][data.id]["choice"] = data.choice;
      gamesObj[data.room]["players"][data.id]["name"] = data.id;
      gamesObj[data.room]["choicesSubmitted"] += 1
      console.log(gamesObj)

      // when there are 2 clients - pair em up and start a game! Once they've chosen!
      if (gamesObj[data.room]["choicesSubmitted"]==2) {
        console.log("this runs!")
        let p1 = gamesObj[data.room]["players"][Object.keys(gamesObj[data.room]["players"])[0]]
        let p2 = gamesObj[data.room]["players"][Object.keys(gamesObj[data.room]["players"])[1]]
        let result = {
          "Rock": {"Rock": "you tied", "Paper": "you lost", "Scissors": "you won"},
          "Paper": {"Rock": "you won", "Paper": "you tied", "Scissors": "you lost"},
          "Scissors": {"Rock": "you lost", "Paper": "you won", "Scissors": "you tied"}
      }
        let p1r = result[p1["choice"]][p2["choice"]]
        let p2r = result[p2["choice"]][p1["choice"]]
        let resultToInt = {"you tied":0, "you lost":0, "you won":1}

        // update scores in room
        gamesObj[data.room]["players"][p1.name]["score"] += resultToInt[p1r]
        gamesObj[data.room]["players"][p2.name]["score"] += resultToInt[p2r]

        // find and send results
        io.to(p1.name).emit("outcome", [p1r, gamesObj[data.room]["players"]])
        io.to(p2.name).emit("outcome", [p2r, gamesObj[data.room]["players"]])
        p1["choice"] = null
        p2["choice"] = null

        gamesObj[data.room]["choicesSubmitted"] = 0
      }
      })

  });


server.listen(port, () => console.log(`Listening on port ${port}`));


