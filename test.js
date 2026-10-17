const jwt = require("jsonwebtoken");

// read payload without verifying
let token = "$2a$10$bZdAUxHz3Zzybg0XdSSK8.TDRk0bDIx4Jr30TRqa7wpgYRrJ9oJ2y"
console.log(jwt.decode(token));

// verify signature with your secret, then read payload
const data = jwt.verify(token, "change_me_to_a_long_random_string");
console.log(data);