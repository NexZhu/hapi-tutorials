'use strict'

const Hapi = require('hapi')

const server = new Hapi.Server()
server.connection({port: 3001})

server.route({
    method: 'POST',
    path: '/',
    handler: (req, res) => {
        console.log(req.payload)
    },
})

server.start()
    .then(err => {

        if (err) throw error

        console.log('Log server running at: ' + server.info.uri)
    })
