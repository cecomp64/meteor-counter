#!/bin/bash
# Development helper script

case "$1" in
  start)
    echo "🚀 Starting Meteor Counter development environment..."
    docker-compose up -d
    echo ""
    echo "✅ Services started!"
    echo "📊 Database: postgresql://meteor:meteor_dev_password@localhost:5432/meteor_counter"
    echo "🌐 App: http://localhost:8888"
    echo ""
    echo "📝 View logs:"
    echo "   docker-compose logs -f app"
    echo ""
    echo "🔍 Check status:"
    echo "   docker-compose ps"
    ;;

  stop)
    echo "🛑 Stopping services..."
    docker-compose stop
    ;;

  restart)
    echo "🔄 Restarting services..."
    docker-compose restart
    ;;

  logs)
    if [ -z "$2" ]; then
      docker-compose logs -f
    else
      docker-compose logs -f "$2"
    fi
    ;;

  shell)
    echo "🐚 Opening shell in app container..."
    docker-compose exec app /bin/bash
    ;;

  psql)
    echo "🗄️  Connecting to PostgreSQL..."
    docker-compose exec postgres psql -U meteor -d meteor_counter
    ;;

  reset-db)
    echo "⚠️  Resetting database..."
    docker-compose exec postgres psql -U meteor -d meteor_counter -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
    docker-compose exec postgres psql -U meteor -d meteor_counter < src/database/schema.sql
    echo "✅ Database reset complete!"
    ;;

  rebuild)
    echo "🔨 Rebuilding containers..."
    docker-compose down
    docker-compose build --no-cache
    docker-compose up -d
    echo "✅ Rebuild complete!"
    ;;

  clean)
    echo "🧹 Cleaning up everything (INCLUDING DATA)..."
    read -p "Are you sure? This will delete all data! (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      docker-compose down -v
      echo "✅ Cleanup complete!"
    else
      echo "❌ Cancelled"
    fi
    ;;

  *)
    echo "Meteor Counter Development Helper"
    echo ""
    echo "Usage: ./dev.sh [command]"
    echo ""
    echo "Commands:"
    echo "  start      - Start all services"
    echo "  stop       - Stop all services"
    echo "  restart    - Restart all services"
    echo "  logs       - View logs (optionally: logs app or logs postgres)"
    echo "  shell      - Open bash shell in app container"
    echo "  psql       - Connect to PostgreSQL"
    echo "  reset-db   - Reset database (keeps data volume)"
    echo "  rebuild    - Rebuild containers from scratch"
    echo "  clean      - Stop and remove everything including data"
    echo ""
    echo "Examples:"
    echo "  ./dev.sh start"
    echo "  ./dev.sh logs app"
    echo "  ./dev.sh psql"
    ;;
esac
