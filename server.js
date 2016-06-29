'use strict'

const Hapi   = require('hapi')
const Cookie = require('hapi-auth-cookie')
// const Basic = require('hapi-auth-basic')
const Joi    = require('joi')
const Inert  = require('inert')
const Good   = require('good')

const Bcrypt = require('bcrypt')
// const Path   = require('path')

const server = new Hapi.Server({
    // connections: {
    //     routes: {
    //         files: {
    //             relativeTo: Path.join(__dirname, 'public'),
    //         },
    //     },
    // },
})

server.connection({port: 3000})

let uuid = 1

const users = {
    john: {
        username: 'john',
        password: '$2a$04$EPcHOWxFnxfc2DVvPGujku0g062DPNCFHcY5T2INUTBbVrJ1ptxw2', // 123
        name: 'John Doe',
        id: '2133d32a',
    },
}

const signinHandler = (req, rep) => {

    if (req.auth.isAuthenticated)
        return rep.redirect('/')

    let message = ''
    let account = null

    if (req.method === 'post') {
        if (!req.payload.username || !req.payload.password) {
            message = 'Missing username or password'
        } else {
            account = users[req.payload.username]
            if (!account || !Bcrypt.compareSync(req.payload.password, account.password)) {
                message = 'Invalid username or password'
            }
        }
    }

    if (req.method === 'get' || message) {
        return rep(`
            <html>
                <head><title>Signin page</title></head>
                <body>
                    ${(message ? '<h3>' + message + '</h3><br/>' : '')}
                    <form method="post" action="/signin">
                        Username: <input name="username" type="text"><br>
                        Password: <input name="password" type="password"><br/>
                        <input type="submit" value="Signin">
                    </form>
                </body>
            </html>`)
    }

    const sid = String(uuid++)
    req.server.app.cache.set(sid, {account: account}, 0, err => {

        if (err)
            rep(err)

        req.cookieAuth.set({sid: sid})

        return rep.redirect('/')
    })
}

const validate = (request, session, callback) => {

    server.app.cache.get(session.sid, (err, cached) => {

        if (err)
            return callback(err, false)

        if (!cached)
            return callback(null, false)

        return callback(null, true, cached.account)
    })
}

// const validate = (req, username, password, cb) => {
//
//     const user = users[username]
//
//     if (!user || (req.params.name && req.params.name !== username)) {
//         return cb(null, false)
//     }
//
//     Bcrypt.compare(password, user.password, (err, isValid) => {
//         cb(err, isValid, {
//             id: user.id,
//             name: user.name
//         })
//     })
// }

const goodOptions = {
    ops: {
        interval: 1000,
    },
    reporters: {
        console: [{
            module: 'good-squeeze',
            name: 'Squeeze',
            args: [{
                response: '*',
                log: '*',
            }],
        }, {module: 'good-console'}, 'stdout'],
        file: [{
            module: 'good-squeeze',
            name: 'Squeeze',
            // args: [{ops: '*'}],
            args: [{error: '*'}],
        }, {
            module: 'good-squeeze',
            name: 'SafeJson',
        }, {
            module: 'good-file',
            args: ['./test/fixtures/awesome_log'],
        }],
        http: [{
            module: 'good-squeeze',
            name: 'Squeeze',
            // args: [{error: '*'}],
            args: [{response: '*'}],
        }, {
            module: 'good-http',
            args: ['http://glaciovolcano:3001', {
                // threshold: 4,
                wreck: {
                    headers: {'x-api-key': 12345},
                },
            }],
        }],
    },
}

server.register([Cookie/*Basic*/, Inert, {
    register: Good,
    options: goodOptions,
}])
    .then(err => {

        if (err)
            throw err

        const cache      = server.cache({
            segment: 'sessions',
            expiresIn: 10 * 1000
        })
        server.app.cache = cache

        server.auth.strategy('session', 'cookie', {
            cookie: 'sid',
            password: 'password-should-be-32-characters',
            redirectTo: '/signin',
            isSecure: false,
            validateFunc: validate,
        })
        // server.auth.strategy('simple', 'basic', {validateFunc: validate})

        server.route({
            method: ['GET', 'POST'],
            path: '/signin',
            handler: signinHandler,

        })

        server.route({
            method: 'GET',
            path: '/{name?}',
            handler: (req, rep) => {
                rep('Hello, ' + encodeURIComponent(req.auth.credentials.name) + '! '
                    + (req.query.content ? req.query.content : ''))
            },
            config: {
                auth: 'session'/*'simple'*/,
                validate: {
                    query: {
                        content: Joi.string().min(3).max(10).default('default')
                    }
                },
                description: 'Say hello!',
                notes: 'Say hello to the user',
                tags: ['api', 'greeting'],
            },
        })

        server.route({
            method: 'GET',
            path: '/file/{param*}',
            handler: {
                directory: {
                    path: 'public',
                    listing: true,
                    defaultExtension: 'html',
                    // index: ['index.html', 'hello.html'],
                },
            },
        })

        return server.start()
    })
    .then(err => {

        if (err)
            throw err

        server.log('info', 'Server running at: ' + server.info.uri)
    })
