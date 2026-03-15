Descripción del archivo de exportación

 El fichero «meta.properties» contiene información general de la grabación y del dispositivo:
 - version_number: versión de la aplicación (mayor, menor y revisión)
 - build_date: fecha de compilación de la aplicación
 - version_number: versión de la aplicación (número entero)
 - time_length: duración de la grabación en segundos
 - uuid: identificador aleatorio generado al iniciar la aplicación
 - leq_mean: nivel de sonido medio equivalente en dB(A) de la medición
 - record_utc: hora de la grabación en milisegundos (epoch)
 - device_manufacturer device_model device_product: información general del dispositivo de medida
 - pleasantness: nivel de agardo percibido por el usuario (1-100)
 - tags: etiquetas seleccionadas por el usuario, separadas por comas (solo inglés)

 track.geojson muestars de 1 s de las mediciones en formato GeoJSON (http://geojson.io)
 - leq_mean: nivel sonoro equivalente 1s en dB(A)
 - accuracy: precisión de la localización establecida en m (proporcionada por GPS, red de telefonía o GSM)
 - location_utc: referncia UTC en milisegundos (epoch)
 - leq_utc: Hora de la medición en milisegundos (epoch)
 - leq_id: identificador único de la grabación
 - marker_color: color utilizado por geojson.io
 - bearing: orientación horizontal del teléfono. Ver https://developer.android.com/reference/android/location/Location.html#getBearing()
 - speed: velocidad estimada del dispositivo en m/s
 - leq_frequency: nivel de sonido equivalente 1s en dB(A) para la frecuencia especificada
