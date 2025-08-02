# Etapa de build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["AsistenteWebApi.csproj", "."]
RUN dotnet restore "./AsistenteWebApi.csproj"
COPY . .
RUN dotnet publish "AsistenteWebApi.csproj" -c Release -o /app/publish

# Etapa de runtime
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
EXPOSE 5000
ENV ASPNETCORE_URLS=http://+:5000
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "AsistenteWebApi.dll"]