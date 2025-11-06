{
    "store": {
        "type": "sqlite",
        "dbname": "db"
    },
    "service": {
	    "port": "#js parseInt(process.env.SERVICE_PORT || '8080')"
    }
}
