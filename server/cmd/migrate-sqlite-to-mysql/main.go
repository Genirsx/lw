package main

import (
	"log"

	"lw/go-server/internal/app"
)

func main() {
	if err := app.RunSQLiteToMySQLMigration(); err != nil {
		log.Fatal(err)
	}
}
